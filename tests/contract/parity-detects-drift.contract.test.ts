/**
 * @jest-environment node
 *
 * Contract: the parity gate actually bites (issue #350's third acceptance
 * criterion — "the check has failed at least once on a deliberately seeded
 * defect").
 *
 * A gate nobody has ever seen fail is indistinguishable from a gate that cannot
 * fail, so the seeded defect is committed and repeatable rather than a one-off
 * manual experiment. Each case writes a corrupted **copy** of the mock data,
 * boots Mockoon on it, and checks the responses against the **pristine**
 * contract — which is why `startMockoon` and `checkResponseParity` take the mock
 * and the contract as separate inputs even though production passes the same
 * file to both.
 *
 * Scenario coverage (agents.md step 2):
 *   - Negative — a renamed, retyped and added response field, plus an
 *     undocumented status, each replayed through the real mock.
 *   - Boundary — the rules that Mockoon cannot be made to produce (a malformed
 *     body, an empty body under a schema-bearing response) are driven directly
 *     against `checkResponseParity`.
 *   - Positive — covered by `mockoon-openapi-parity.contract.test.ts`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020';

import { replayOperation, startMockoon } from './utils/mockoon-harness';
import {
  findOperation,
  readContract,
  unsupportedResponseConstructs,
  type ContractOperation,
  type OpenApiDocument,
  type SchemaObject,
} from './utils/openapi-contract';
import {
  checkResponseParity,
  type ParityProblemKind,
  type ObservedResponse,
} from './utils/response-parity';

const SEED_TIMEOUT_MS = 30_000;

const ajv = new Ajv2020({ strict: false, allErrors: true });
const contract = readContract();

/** Fails with the operation's name rather than an opaque destructuring TypeError. */
function requireOperation(method: 'get' | 'delete', routePath: string): ContractOperation {
  const found = findOperation(contract, method, routePath);
  if (found === undefined) {
    const label = `${method.toUpperCase()} ${routePath}`;
    throw new Error(`${label} is missing from the contract — the seeded-defect cases assume it`);
  }
  return found;
}

const LIST_USERS = requireOperation('get', '/api/users');
const DELETE_USER = requireOperation('delete', '/api/users/{id}');

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'mockoon-parity-'));
});

afterAll(() => {
  // Each case writes a full copy of the contract; without this the directories
  // accumulate in $TMPDIR on every local run and on self-hosted runners.
  rmSync(workDir, { recursive: true, force: true });
});

/** A mutable deep copy of the contract, used as corrupted *mock data* only. */
type MutableDocument = {
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
};

/** The response-item properties the seeded mutations rewrite. */
function itemProperties(document: MutableDocument): Record<string, SchemaObject> {
  const response = document.paths['/api/users']?.get?.responses['200'] as {
    content: Record<string, { schema: { items: { properties: Record<string, SchemaObject> } } }>;
  };
  return response.content['application/json']!.schema.items.properties;
}

/** Serialises a corrupted copy of the mock data and boots Mockoon on it. */
async function replayCorruptedMock(
  name: string,
  corrupt: (document: MutableDocument) => void
): Promise<ObservedResponse> {
  const corrupted = JSON.parse(JSON.stringify(contract)) as MutableDocument;
  corrupt(corrupted);

  const dataFile = path.join(workDir, `${name}.json`);
  writeFileSync(dataFile, JSON.stringify(corrupted));

  const mockoon = await startMockoon(dataFile);
  try {
    return await replayOperation(mockoon.baseUrl, LIST_USERS);
  } finally {
    await mockoon.stop();
  }
}

async function seededProblemKinds(
  name: string,
  corrupt: (document: MutableDocument) => void
): Promise<ParityProblemKind[]> {
  const observed = await replayCorruptedMock(name, corrupt);
  return checkResponseParity(LIST_USERS, observed, ajv).map(({ kind }) => kind);
}

describe('a seeded defect in the mock data turns the gate red', () => {
  it(
    'catches a renamed response field',
    async () => {
      // The issue's own worked example. Note ajv alone does NOT catch this: the
      // upstream document misplaces `required` on the array schema instead of
      // on its `items`, so only the undeclared-property rule sees the rename.
      const kinds = await seededProblemKinds('renamed-field', document => {
        const properties = itemProperties(document);
        properties.emailAddress = properties.email!;
        delete properties.email;
      });

      expect(kinds).toContain('undeclared-property');
    },
    SEED_TIMEOUT_MS
  );

  it(
    'catches a retyped response field',
    async () => {
      const kinds = await seededProblemKinds('retyped-field', document => {
        itemProperties(document).confirmed = { type: 'string' };
      });

      expect(kinds).toContain('schema-violation');
    },
    SEED_TIMEOUT_MS
  );

  it(
    'catches a response field the contract never declares',
    async () => {
      const kinds = await seededProblemKinds('added-field', document => {
        itemProperties(document).unexpected = { type: 'string' };
      });

      expect(kinds).toContain('undeclared-property');
    },
    SEED_TIMEOUT_MS
  );

  it(
    'catches a status the contract does not document',
    async () => {
      const kinds = await seededProblemKinds('moved-status', document => {
        const { responses } = document.paths['/api/users']!.get!;
        responses['299'] = responses['200']!;
        delete responses['200'];
      });

      expect(kinds).toEqual(['undocumented-status']);
    },
    SEED_TIMEOUT_MS
  );
});

describe('the unsupported-construct tripwire is precise in both directions', () => {
  // It guards a BLOCKING gate, so a false positive is as costly as a miss: one
  // reds CI over a perfectly supported contract, the other quietly validates
  // less. Property names are chosen by the API author and are never schema
  // keywords, and `example`/`enum` values are data — but a real sub-schema
  // nested under a property that happens to be *named* `example` still counts.
  const mutated = (corrupt: (document: MutableDocument) => void): string[] => {
    const copy = JSON.parse(JSON.stringify(contract)) as MutableDocument;
    corrupt(copy);
    return unsupportedResponseConstructs(copy as unknown as OpenApiDocument);
  };

  const mediaType = (document: MutableDocument): Record<string, unknown> =>
    (
      document.paths['/api/users']!.get!.responses['200'] as {
        content: Record<string, Record<string, unknown>>;
      }
    ).content['application/json']!;

  it('is silent on the committed contract', () => {
    expect(unsupportedResponseConstructs(contract)).toEqual([]);
  });

  it('does not flag a property whose NAME is a schema keyword', () => {
    expect(
      mutated(document => Object.assign(itemProperties(document), { allOf: { type: 'string' } }))
    ).toEqual([]);
  });

  it('does not flag example or enum data that contains schema-like keys', () => {
    expect(
      mutated(document => Object.assign(mediaType(document), { example: [{ allOf: 'x' }] }))
    ).toEqual([]);
    expect(
      mutated(document =>
        Object.assign(itemProperties(document).email!, { enum: [{ oneOf: 'x' }] })
      )
    ).toEqual([]);
  });

  it('flags a real sub-schema nested under a property named `example`', () => {
    expect(
      mutated(document =>
        Object.assign(itemProperties(document), { example: { oneOf: [{ type: 'string' }] } })
      )
    ).toHaveLength(1);
  });

  it('flags a composed schema, a nested composition and a media-type $ref', () => {
    expect(
      mutated(document =>
        Object.assign(mediaType(document), { schema: { allOf: [{ type: 'object' }] } })
      )
    ).toHaveLength(1);
    expect(
      mutated(document =>
        Object.assign(itemProperties(document), { email: { oneOf: [{ type: 'string' }] } })
      )
    ).toHaveLength(1);
    expect(
      mutated(document => {
        const { responses } = document.paths['/api/users']!.get!;
        responses['200'] = { content: { 'application/json': { $ref: '#/components/x' } } };
      })
    ).toHaveLength(1);
  });
});

describe('the rules Mockoon cannot be made to produce', () => {
  const observe = (overrides: Partial<ObservedResponse>): ObservedResponse => ({
    status: 200,
    contentType: 'application/json',
    body: '[]',
    ...overrides,
  });

  const kindsFor = (
    operation: ContractOperation,
    observed: ObservedResponse
  ): ParityProblemKind[] => checkResponseParity(operation, observed, ajv).map(({ kind }) => kind);

  it('rejects a body that is not parseable as its declared media type', () => {
    expect(kindsFor(LIST_USERS, observe({ body: '<html>not json</html>' }))).toEqual([
      'malformed-body',
    ]);
  });

  it('rejects an empty body where the contract declares a schema', () => {
    expect(kindsFor(LIST_USERS, observe({ body: '' }))).toEqual(['schema-violation']);
  });

  it('rejects a media type the status does not declare', () => {
    expect(kindsFor(LIST_USERS, observe({ contentType: 'application/xml' }))).toEqual([
      'undocumented-media-type',
    ]);
  });

  it('rejects a status the operation does not document', () => {
    expect(kindsFor(LIST_USERS, observe({ status: 418 }))).toEqual(['undocumented-status']);
  });

  it('rejects a body on a status that must not carry one', () => {
    // DELETE /api/users/{id} documents 204 — and, as an upstream defect, even
    // declares `application/json` on it. A body there is still drift.
    expect(kindsFor(DELETE_USER, observe({ status: 204, body: '{}' }))).toEqual([
      'undeclared-body',
    ]);
  });

  it('accepts an empty body on a status that must not carry one', () => {
    expect(kindsFor(DELETE_USER, observe({ status: 204, contentType: '', body: '' }))).toEqual([]);
  });
});
