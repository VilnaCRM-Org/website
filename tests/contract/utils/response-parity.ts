/**
 * The parity rules: does one observed HTTP response match what the contract
 * documents for the operation that produced it?
 *
 * Deliberately pure — it takes an already-captured response, so the same rules
 * are exercised both against the live mock (`mockoon-openapi-parity`) and
 * against deliberately corrupted mock data (`parity-detects-drift`). Nothing
 * here reads the network, the clock, or the filesystem.
 *
 * The four rules, in the order they are applied:
 *
 *   1. **status**       — the status served must be one the operation documents.
 *   2. **media type**   — a body must arrive under a media type that status declares.
 *   3. **schema**       — a body must validate against that media type's schema.
 *   4. **no extras**    — a body must not carry a property the schema never declares.
 *
 * Rule 4 is the load-bearing one for mock drift and is *stricter* than OpenAPI's
 * default (`additionalProperties` is permissive unless stated). That is
 * deliberate: a mock offering a field the contract does not describe is exactly
 * the "e2e certifies behavior the real API does not have" defect this gate
 * exists to catch. It is also the only rule that catches a renamed field in
 * this contract, because the upstream document misplaces `required` on the
 * array schema of `GET /api/users` instead of on its `items` — so ajv alone
 * accepts a response with every property renamed.
 */
import type { ValidateFunction } from 'ajv';
import type Ajv from 'ajv/dist/2020';

import type { ContractOperation, MediaTypeObject, SchemaObject } from './openapi-contract';

export type ParityProblemKind =
  | 'undocumented-status'
  | 'undeclared-body'
  | 'undocumented-media-type'
  | 'malformed-body'
  | 'schema-violation'
  | 'undeclared-property';

export interface ParityProblem {
  readonly kind: ParityProblemKind;
  readonly detail: string;
}

export interface ObservedResponse {
  readonly status: number;
  /** Media type with parameters stripped (`application/json`, not `…; charset=utf-8`). Empty when the response carried no `Content-Type`. */
  readonly contentType: string;
  /** Raw response text, exactly as served. */
  readonly body: string;
}

/**
 * Statuses RFC 9110 forbids a body on. An empty body is correct for these no
 * matter what the document declares — this contract declares
 * `application/json` on `DELETE /api/users/{id}` 204, which is an upstream
 * defect that spectral already sees and which must not be reported here as
 * mock drift.
 */
const BODYLESS_STATUSES: ReadonlySet<number> = new Set([204, 304]);

const problem = (kind: ParityProblemKind, detail: string): ParityProblem => ({ kind, detail });

/**
 * Property paths present in `value` that `schema` never declares.
 *
 * Recurses only where the schema describes the shape (`properties`, `items`);
 * a schema with no `properties` describes a free-form object and is skipped.
 */
export function undeclaredProperties(
  schema: SchemaObject | undefined,
  value: unknown,
  trail: string = ''
): string[] {
  if (!schema || value === null || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      undeclaredProperties(schema.items, entry, `${trail}[${index}]`)
    );
  }

  const { properties } = schema;
  if (!properties) return [];

  const entries = Object.entries(value as Record<string, unknown>);
  return entries.flatMap(([key, nested]) => {
    const at = `${trail}.${key}`;
    // `Object.hasOwn`, not `properties[key] !== undefined`: a response field
    // named `constructor`, `toString` or `valueOf` would otherwise resolve to
    // an Object.prototype member and be waved through as "declared".
    if (!Object.hasOwn(properties, key)) return [at];
    return undeclaredProperties(properties[key], nested, at);
  });
}

function checkBody(
  mediaType: MediaTypeObject,
  observed: ObservedResponse,
  ajv: Ajv
): ParityProblem[] {
  const { schema } = mediaType;
  // No schema means the contract prescribes only an example (several responses
  // in this document do, with `example: ""`). There is nothing to validate.
  if (!schema) return [];

  if (observed.body.length === 0) {
    return [problem('schema-violation', `empty body where the contract declares a schema`)];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(observed.body);
  } catch {
    return [problem('malformed-body', `body is not parseable as ${observed.contentType}`)];
  }

  const validate: ValidateFunction = ajv.compile(schema);
  if (!validate(parsed)) {
    return [problem('schema-violation', ajv.errorsText(validate.errors))];
  }

  return undeclaredProperties(schema, parsed).map(at =>
    problem('undeclared-property', `response carries \`${at}\`, which the contract never declares`)
  );
}

/** Applies every parity rule to one observed response. An empty array means parity holds. */
export function checkResponseParity(
  { operation }: ContractOperation,
  observed: ObservedResponse,
  ajv: Ajv
): ParityProblem[] {
  const documented = operation.responses ?? {};
  const status = String(observed.status);
  // `Object.hasOwn` guards every lookup here for the reason spelled out in
  // `undeclaredProperties`: an inherited Object.prototype member must never
  // read as something the contract declared.
  const declared = Object.hasOwn(documented, status) ? documented[status] : undefined;

  if (declared === undefined) {
    const known = Object.keys(documented).join(', ') || 'none';
    return [problem('undocumented-status', `served ${status}; contract documents ${known}`)];
  }

  // A bodyless status is satisfied by an empty body regardless of what the
  // document declares; anything else served under one is real drift.
  if (BODYLESS_STATUSES.has(observed.status)) {
    return observed.body.length === 0
      ? []
      : [
          problem(
            'undeclared-body',
            `${status} must not carry a body, got ${observed.body.length}B`
          ),
        ];
  }

  const content = declared.content ?? {};
  const declaredMediaTypes = Object.keys(content);

  if (declaredMediaTypes.length === 0) {
    return observed.body.length === 0
      ? []
      : [problem('undeclared-body', `${status} declares no content, got ${observed.body.length}B`)];
  }

  const mediaType = Object.hasOwn(content, observed.contentType)
    ? content[observed.contentType]
    : undefined;
  if (mediaType === undefined) {
    return [
      problem(
        'undocumented-media-type',
        `served \`${observed.contentType || 'no Content-Type'}\`; contract declares ${declaredMediaTypes.join(', ')}`
      ),
    ];
  }

  return checkBody(mediaType, observed, ajv);
}

/** Renders problems for a Jest failure message, one per line. */
export function formatProblems(label: string, problems: readonly ParityProblem[]): string {
  return problems.map(({ kind, detail }) => `${label}: [${kind}] ${detail}`).join('\n');
}
