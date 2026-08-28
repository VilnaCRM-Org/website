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
 * Scenario coverage (AGENTS.md step 2):
 *   - Positive — every documented operation replayed against the live mock.
 *   - Negative / boundary — `parity-detects-drift.contract.test.ts` seeds a
 *     renamed field, a retyped field, an extra field and a removed status into
 *     the mock data and asserts each turns this gate red.
 *   - Locale / responsive / a11y — Not applicable: this layer observes an HTTP
 *     mock's wire format, which has no rendered UI and no localized text.
 */
import Ajv2020 from 'ajv/dist/2020';

import { MOCK_API_USER, MOCK_API_USERS } from '@/test/e2e/swagger/utils/constants';

import { replayOperation, startMockoon, type MockoonHandle } from './utils/mockoon-harness';
import {
  CONTRACT_PATH,
  findOperation,
  listOperations,
  readContract,
  responseSchema,
  unsupportedResponseConstructs,
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

  it('still routes at least as many operations through full body validation', () => {
    // Mockoon serves the FIRST response an operation declares, so only that one
    // is ever observed — and of those, only the schema-bearing ones reach the
    // schema and undeclared-property rules. Today 7 of 12 do; the rest declare
    // `example: ""` with no schema, or are bodyless 204s.
    //
    // This is a ratchet, not a target. Without it the gate could quietly shrink
    // to validating nothing — an upstream reorder that put a schema-less
    // response first on every operation would leave every assertion green.
    // Raise the floor when the count rises; never lower it.
    const withSchema = operations.filter(({ operation }) => {
      const first = Object.keys(operation.responses ?? {})[0];
      return first !== undefined && responseSchema(operation, first) !== undefined;
    });

    expect(withSchema.length).toBeGreaterThanOrEqual(7);
  });

  it('uses only response-schema constructs the parity rules can reason about', () => {
    // ajv is handed each response schema on its own, with no resolver, and the
    // undeclared-property rule walks `properties`/`items` only. A `$ref`, or a
    // schema composed through `allOf`/`oneOf`/`prefixItems`/…, would make the
    // gate quietly validate less while still reporting green — so the day
    // `make update-contracts` pulls a spec that uses one, this must fail loudly.
    // Extend the rules (never this list) when that day comes.
    expect(unsupportedResponseConstructs(contract)).toEqual([]);
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
  const itemSchema = collectionSchema?.items;

  it('exposes the GET /api/users 200 item schema the fixtures are held against', () => {
    // Both assertions below reach through `.items`. Guarding only the
    // collection would let them pass vacuously the day upstream drops it —
    // the undeclared-property rule would stop checking the user shape while
    // reporting green, which is the regression this gate exists to catch.
    expect(collectionSchema).toBeDefined();
    expect(itemSchema).toBeDefined();
  });

  it('validates MOCK_API_USERS against that schema', () => {
    // No `?? {}` fallback: an empty schema validates anything, so a missing
    // schema would turn this into an assertion that always passes.
    const validate = ajv.compile(collectionSchema as object);

    expect(validate(MOCK_API_USERS) ? '' : ajv.errorsText(validate.errors)).toBe('');
  });

  it('declares every property the ApiUser fixture carries', () => {
    expect(undeclaredProperties(itemSchema, MOCK_API_USER)).toEqual([]);
  });
});
