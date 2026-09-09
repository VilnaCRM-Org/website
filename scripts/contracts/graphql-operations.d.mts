// Declaration shim for the sibling ESM script `graphql-operations.mjs`, which
// stays plain JavaScript so it runs directly under Node in CI without a build
// step. Types let src/test/unit/contracts/lint-contracts-graphql.test.ts import
// it safely under `allowJs: false`.
export interface GqlDocument {
  file: string;
  body: string;
}

export interface OperationCheckOptions {
  /** Path to the SDL file. Ignored when `schemaSdl` is given. */
  schemaPath?: string;
  /** SDL text, for callers that already hold it. */
  schemaSdl?: string;
  /** Directory whose `.ts`/`.tsx` files are scanned for gql documents. */
  sourceDir: string;
}

export interface OperationCheckResult {
  documentCount: number;
  failures: string[];
}

export function walk(dir: string): string[];
export function extractGqlDocuments(file: string): GqlDocument[];
export function collectGqlDocuments(sourceDir: string): GqlDocument[];
export function checkGraphqlOperations(options: OperationCheckOptions): OperationCheckResult;
