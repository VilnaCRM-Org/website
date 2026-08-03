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
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020';

import { replayOperation, startMockoon } from './utils/mockoon-harness';
import {
  findOperation,
  readContract,
  type ContractOperation,
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

const listUsers = findOperation(contract, 'get', '/api/users');
if (listUsers === undefined) {
  throw new Error(
    'GET /api/users is missing from the contract — the seeded-defect cases assume it'
  );
}
const LIST_USERS: ContractOperation = listUsers;

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'mockoon-parity-'));
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

describe('the rules Mockoon cannot be made to produce', () => {
  const deleteUser = findOperation(contract, 'delete', '/api/users/{id}');

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
    expect(kindsFor(deleteUser!, observe({ status: 204, body: '{}' }))).toEqual([
      'undeclared-body',
    ]);
  });

  it('accepts an empty body on a status that must not carry one', () => {
    expect(kindsFor(deleteUser!, observe({ status: 204, contentType: '', body: '' }))).toEqual([]);
  });
});
