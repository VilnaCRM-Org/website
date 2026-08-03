/**
 * A minimal, read-only view of the committed user-service OpenAPI document.
 *
 * `contracts/user-service/openapi.json` plays two roles at once: it is the
 * pinned upstream contract (fetched by `make update-contracts`, drift-gated by
 * `make lint-contracts`) **and** the data file `Mockoon.Dockerfile` copies into
 * the mock the e2e suite runs against. This module reads it as the *contract*
 * side of that pair; `mockoon-harness.ts` boots the *mock* side.
 *
 * Only the slice the parity gate needs is typed. The document is OpenAPI 3.1
 * with inline response schemas and no `$ref` indirection, so no resolver is
 * required — `unsupportedResponseConstructs` below, asserted empty by the parity
 * spec, fails loudly if that ever stops being true.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CONTRACT_PATH: string = path.join('contracts', 'user-service', 'openapi.json');

/**
 * The HTTP methods a path item may declare. Everything else it can hold
 * (`summary`, `description`, `parameters`, …) is not an operation.
 */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * A JSON Schema as it appears inside an OpenAPI media type. Indexed by an open
 * `unknown` signature because OpenAPI documents legitimately carry annotation
 * keywords (`example`, `deprecated`, `xml`) that are not JSON Schema.
 */
export interface SchemaObject {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, SchemaObject>>;
  readonly items?: SchemaObject;
  readonly required?: readonly string[];
  readonly [keyword: string]: unknown;
}

export interface MediaTypeObject {
  readonly schema?: SchemaObject;
  readonly example?: unknown;
}

export interface ResponseObject {
  readonly description?: string;
  readonly content?: Readonly<Record<string, MediaTypeObject>>;
}

export interface RequestBodyObject {
  readonly required?: boolean;
  readonly content?: Readonly<Record<string, MediaTypeObject>>;
}

export interface OperationObject {
  readonly operationId?: string;
  readonly requestBody?: RequestBodyObject;
  readonly responses?: Readonly<Record<string, ResponseObject>>;
}

export interface OpenApiDocument {
  readonly openapi: string;
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** One replayable operation, flattened out of the nested `paths` structure. */
export interface ContractOperation {
  readonly method: HttpMethod;
  readonly path: string;
  /** `GET /api/users` — the label every parity failure is reported against. */
  readonly label: string;
  readonly operation: OperationObject;
}

const isHttpMethod = (value: string): value is HttpMethod =>
  (HTTP_METHODS as readonly string[]).includes(value);

export function readContract(filePath: string = CONTRACT_PATH): OpenApiDocument {
  return JSON.parse(readFileSync(filePath, 'utf8')) as OpenApiDocument;
}

/** Flattens `paths` into one entry per HTTP operation, in document order. */
export function listOperations(document: OpenApiDocument): ContractOperation[] {
  return Object.entries(document.paths).flatMap(([routePath, pathItem]) =>
    Object.entries(pathItem)
      .filter(([key]) => isHttpMethod(key))
      .map(([method, operation]) => ({
        method: method as HttpMethod,
        path: routePath,
        label: `${method.toUpperCase()} ${routePath}`,
        operation: operation as OperationObject,
      }))
  );
}

/**
 * Schema keywords the undeclared-property rule cannot reason about.
 *
 * `undeclaredProperties` walks `properties` and `items` only. A schema that
 * describes its shape through composition instead has neither, so the rule
 * treats it as free-form and silently stops checking — and ajv does not
 * backstop it whenever the composition also loses `required`. `$ref` is the
 * same class of problem one level up: ajv is handed each schema on its own,
 * with no resolver.
 *
 * These are unsupported rather than forbidden. The contract uses none of them
 * today; the parity spec asserts that stays true, so the day `make
 * update-contracts` pulls a spec that uses one, the gate fails loudly instead
 * of quietly validating less.
 */
export const UNSUPPORTED_SCHEMA_KEYWORDS = [
  '$ref',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'prefixItems',
  'patternProperties',
  'additionalProperties',
] as const;

/**
 * Every `<location> -> <keyword>` in the document's response schemas that the
 * parity rules cannot handle.
 */
export function unsupportedResponseConstructs(document: OpenApiDocument): string[] {
  const found: string[] = [];

  const walk = (node: unknown, trail: string): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${trail}[${index}]`));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if ((UNSUPPORTED_SCHEMA_KEYWORDS as readonly string[]).includes(key)) {
        found.push(`${trail}.${key}`);
      }
      walk(value, `${trail}.${key}`);
    }
  };

  listOperations(document).forEach(({ label, operation }) =>
    walk(operation.responses ?? {}, `${label} responses`)
  );

  return found;
}

/**
 * Looks up a single operation by method and path, or `undefined` when the
 * contract does not document it.
 */
export function findOperation(
  document: OpenApiDocument,
  method: HttpMethod,
  routePath: string
): ContractOperation | undefined {
  return listOperations(document).find(
    entry => entry.method === method && entry.path === routePath
  );
}

/**
 * The response body schema an operation declares for one status and media
 * type, if it declares one.
 */
export function responseSchema(
  operation: OperationObject,
  status: string,
  mediaType: string = 'application/json'
): SchemaObject | undefined {
  return operation.responses?.[status]?.content?.[mediaType]?.schema;
}

/**
 * The request body the contract's own example prescribes, if any.
 *
 * Mockoon selects a response from method + path alone, so the body never
 * changes what comes back — sending the contract's example simply keeps the
 * replayed request a request the contract says is valid, rather than a
 * synthetic one.
 */
export function exampleRequestBody(
  operation: OperationObject
): { readonly contentType: string; readonly body: string } | undefined {
  const content = operation.requestBody?.content;
  if (!content) return undefined;

  for (const [contentType, mediaType] of Object.entries(content)) {
    if (mediaType.example !== undefined) {
      return { contentType, body: JSON.stringify(mediaType.example) };
    }
  }
  return undefined;
}
