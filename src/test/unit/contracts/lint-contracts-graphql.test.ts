import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkGraphqlOperations } from '../../../../scripts/contracts/graphql-operations.mjs';

/**
 * Issue #348 — the proof that the client-operation gate goes red.
 *
 * `make lint-contracts` validates every gql`...` document under `src/features`
 * against the committed user-service SDL. Until now nothing demonstrated that it
 * FAILS on a real defect, which is exactly the failure mode the parity gate
 * guards against for the OpenAPI half (see
 * tests/contract/parity-detects-drift.contract.test.ts): a checker whose only
 * observed outcome is "pass" is unfalsifiable.
 *
 * Every defect below is seeded into a TEMPORARY directory. The committed
 * artifacts under contracts/ are SHA-256 digest-gated (#376), so mutating them —
 * even transiently — would be indistinguishable from tampering.
 *
 * Scenario classes: positive (the real schema against the real src/features tree
 * reports zero failures), negative (undeclared field, undeclared argument, parse
 * error, interpolated template), boundary (a source tree with no gql documents at
 * all, and an unreadable schema / source directory).
 *
 * Locale / responsive / a11y — Not applicable: this is a build-time contract check.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const REAL_SCHEMA_PATH = path.join(REPO_ROOT, 'contracts/user-service/schema.graphql');
const REAL_SOURCE_DIR = path.join(REPO_ROOT, 'src/features');

// A minimal SDL with the same shape the real one exposes for the single client
// document. Fixtures validate against this rather than the committed file so a
// future upstream bump cannot silently rewrite what these negatives mean.
const SCHEMA_SDL = `
  type User {
    id: ID!
    email: String!
    initials: String!
    confirmed: Boolean!
  }

  input createUserInput {
    clientMutationId: String
    email: String!
    initials: String!
    password: String!
  }

  type createUserPayload {
    user: User
    clientMutationId: String
  }

  type Query {
    node(id: ID!): User
  }

  type Mutation {
    createUser(input: createUserInput!): createUserPayload
  }
`;

const VALID_DOCUMENT = `
  mutation AddUser($input: createUserInput!) {
    createUser(input: $input) {
      user {
        email
        initials
        id
      }
      clientMutationId
    }
  }
`;

// Assembled from pieces so this file never itself contains a literal `${` inside
// a template the extractor would read back as a defect in the repository.
const INTERPOLATION = `\${fields}`;

describe('client GraphQL operation gate', () => {
  let sandbox: string;

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'graphql-operations-'));
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  /** Writes `source` into the sandbox and runs the gate over it. */
  function check(source: string, file = 'api/service/userService.ts') {
    const full = path.join(sandbox, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, source);

    return checkGraphqlOperations({ schemaSdl: SCHEMA_SDL, sourceDir: sandbox });
  }

  /** A `.ts` module wrapping `body` in the gql tag the extractor looks for. */
  const gqlModule = (body: string) =>
    `import { gql } from '@apollo/client';\n\nexport default gql\`${body}\`;\n`;

  it('accepts every document in the real tree against the real committed schema', () => {
    const result = checkGraphqlOperations({
      schemaPath: REAL_SCHEMA_PATH,
      sourceDir: REAL_SOURCE_DIR,
    });

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBeGreaterThan(0);
  });

  it('accepts a valid seeded document', () => {
    const result = check(gqlModule(VALID_DOCUMENT));

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  // Parser-over-regex (FINDING: a scan of the raw source cannot tell executable
  // code from a commented-out or quoted lookalike, so a dead example used to be
  // collected as a client operation and could redden the gate on its own).
  it('ignores a gql template inside a line comment', () => {
    const result = check(
      `${gqlModule(VALID_DOCUMENT)}\n// const dead = gql\`query Dead { nope }\`;\n`
    );

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  it('ignores a gql template inside a block comment', () => {
    const result = check(
      `${gqlModule(VALID_DOCUMENT)}\n/* legacy: gql\`query Dead { nope }\` */\n`
    );

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  it('ignores a gql template inside an ordinary string literal', () => {
    const result = check(
      `${gqlModule(VALID_DOCUMENT)}\nexport const snippet = 'gql\`query Dead { nope }\`';\n`
    );

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  it('collects a member-access gql tag, as the previous scanner did', () => {
    const result = check(
      `import * as Apollo from '@apollo/client';\n\nexport default Apollo.gql\`${VALID_DOCUMENT}\`;\n`
    );

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  it('collects a gql template from a .tsx module', () => {
    const result = check(gqlModule(VALID_DOCUMENT), 'components/form/query.tsx');

    expect(result.failures).toEqual([]);
    expect(result.documentCount).toBe(1);
  });

  it('rejects a selection the schema does not declare', () => {
    const result = check(gqlModule(VALID_DOCUMENT.replace('initials', 'intials')));

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('Cannot query field');
  });

  it('rejects an argument the schema does not declare', () => {
    const result = check(gqlModule(VALID_DOCUMENT.replace('input: $input', 'payload: $input')));

    expect(result.failures.join('\n')).toContain('Unknown argument "payload"');
  });

  it('rejects a syntactically invalid document', () => {
    const result = check(gqlModule('mutation AddUser($input: createUserInput! {'));

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('Syntax Error');
  });

  it('rejects an interpolated template instead of silently validating it', () => {
    const result = check(
      gqlModule(`
  mutation AddUser($input: createUserInput!) {
    createUser(input: $input) { ${INTERPOLATION} }
  }
`)
    );

    expect(result.failures).toEqual([
      expect.stringContaining('interpolated gql template cannot be validated statically'),
    ]);
  });

  it('fails rather than passing vacuously when the tree holds no gql documents', () => {
    const result = check('export const nothing = 1;\n');

    expect(result.documentCount).toBe(0);
    expect(result.failures).toEqual([
      `no gql documents found under ${sandbox} — the extractor is broken`,
    ]);
  });

  it('reports every failure in a tree with more than one defect', () => {
    writeFileSync(
      path.join(sandbox, 'a.ts'),
      gqlModule(VALID_DOCUMENT.replace('input: $input', 'payload: $input'))
    );
    writeFileSync(path.join(sandbox, 'b.ts'), gqlModule(VALID_DOCUMENT.replace('email', 'emial')));

    const result = checkGraphqlOperations({ schemaSdl: SCHEMA_SDL, sourceDir: sandbox });

    expect(result.documentCount).toBe(2);
    // Both files are reported: the walker does not stop at the first defect.
    expect(result.failures.some(message => message.includes('a.ts'))).toBe(true);
    expect(result.failures.some(message => message.includes('b.ts'))).toBe(true);
  });

  it('reports an unparseable schema as a failure rather than throwing', () => {
    const result = checkGraphqlOperations({ schemaSdl: 'type Query {', sourceDir: sandbox });

    expect(result.failures).toEqual([expect.stringContaining('<sdl>')]);
    expect(result.documentCount).toBe(0);
  });

  it('reports an unreadable schema as a failure rather than throwing', () => {
    const result = checkGraphqlOperations({
      schemaPath: path.join(sandbox, 'missing.graphql'),
      sourceDir: sandbox,
    });

    expect(result.failures).toHaveLength(1);
    expect(result.documentCount).toBe(0);
  });

  it('reports an unreadable source directory as a failure rather than throwing', () => {
    const result = checkGraphqlOperations({
      schemaSdl: SCHEMA_SDL,
      sourceDir: path.join(sandbox, 'missing'),
    });

    expect(result.failures).toHaveLength(1);
    expect(result.documentCount).toBe(0);
  });
});
