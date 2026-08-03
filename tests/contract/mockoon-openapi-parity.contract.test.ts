/**
 * @jest-environment node
 *
 * Contract: the Mockoon mock the e2e suite runs against still matches the
 * committed user-service OpenAPI contract (issue #350).
 *
 * The whole Playwright suite talks to Mockoon, so nothing else in this repo
 * checks that the mocked responses still match the API's documented shape — the
 * mock could rot indefinitely while e2e stayed green and the mismatch surfaced
 * only in production (issue #243 / PR #245 is the recorded instance of exactly
 * that class). This spec boots the same mock from the same data file, replays
 * every documented operation, and holds each response against the contract.
 *
 * Scenario coverage (agents.md step 2):
 *   - Positive — every documented operation replayed against the live mock.
 *   - Negative / boundary — `parity-detects-drift.contract.test.ts` seeds a
 *     renamed field, a retyped field, an extra field and a removed status into
 *     the mock data and asserts each turns this gate red.
 *   - Locale / responsive / a11y — Not applicable: this layer observes an HTTP
 *     mock's wire format, which has no rendered UI and no localized text.
 */
import Ajv2020 from 'ajv/dist/2020';

import { MOCK_API_USER, MOCK_API_USERS } from '../../src/test/e2e/swagger/utils/constants';

import { replayOperation, startMockoon, type MockoonHandle } from './utils/mockoon-harness';
import {
  CONTRACT_PATH,
  findOperation,
  listOperations,
  readContract,
  responseSchema,
  type ContractOperation,
} from './utils/openapi-contract';
import { checkResponseParity, formatProblems, undeclaredProperties } from './utils/response-parity';

const BOOT_TIMEOUT_MS = 30_000;

const contract = readContract();
const operations = listOperations(contract);

// `strict: false` because OpenAPI schemas legitimately carry annotation
// keywords (`example`, `deprecated`) that ajv's strict mode rejects as unknown.
const ajv = new Ajv2020({ strict: false, allErrors: true });

let mockoon: MockoonHandle;

beforeAll(async () => {
  mockoon = await startMockoon(CONTRACT_PATH);
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await mockoon?.stop();
});

describe('the committed contract is shaped the way this gate assumes', () => {
  it('declares at least one replayable operation', () => {
    // Mirrors the "no gql documents found — the extractor is broken" guard in
    // lint-contracts.mjs: an empty operation list would make every assertion
    // below pass vacuously.
    expect(operations.length).toBeGreaterThan(0);
  });

  it('inlines every schema, so validation needs no $ref resolver', () => {
    // ajv is handed each response schema on its own. A `$ref` would silently
    // fail to resolve, so the day upstream introduces one this must fail loudly
    // rather than quietly stop validating.
    expect(JSON.stringify(contract)).not.toContain('"$ref"');
  });
});

describe('Mockoon serves what the contract documents', () => {
  it.each(operations.map((operation): [string, ContractOperation] => [operation.label, operation]))(
    '%s',
    async (label, operation) => {
      const observed = await replayOperation(mockoon.baseUrl, operation);
      const problems = checkResponseParity(operation, observed, ajv);

      expect(formatProblems(label, problems)).toBe('');
    }
  );
});

describe('the swagger e2e fixtures describe a user the contract still documents', () => {
  // src/test/e2e/swagger/utils/constants.ts hard-codes the user shape the
  // Playwright specs assert against. If upstream renames or drops a field, the
  // fixture keeps e2e green against a shape the API no longer has — the same
  // drift class, one layer up from the mock.
  const listUsers = findOperation(contract, 'get', '/api/users');
  const collectionSchema = listUsers && responseSchema(listUsers.operation, '200');

  it('exposes the GET /api/users 200 schema the fixtures are held against', () => {
    expect(collectionSchema).toBeDefined();
  });

  it('validates MOCK_API_USERS against that schema', () => {
    const validate = ajv.compile(collectionSchema ?? {});

    expect(validate(MOCK_API_USERS) ? '' : ajv.errorsText(validate.errors)).toBe('');
  });

  it('declares every property the ApiUser fixture carries', () => {
    expect(undeclaredProperties(collectionSchema?.items, MOCK_API_USER)).toEqual([]);
  });
});
