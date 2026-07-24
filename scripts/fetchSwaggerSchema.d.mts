// Declaration shim for the sibling ESM script `fetchSwaggerSchema.mjs`, which
// stays plain JavaScript so it runs directly under Node in CI without a build
// step. Types let src/test/unit/swagger/fetch-swagger.test.ts import it safely
// under `allowJs: false`.
export function buildSpecUrl(): string;
export function fetchSwaggerYaml(url: string): Promise<string>;
export function normalizeSpec(node: unknown): unknown;
export function saveSwaggerJson(
  yamlText: string,
  filePath: string
): Promise<void>;
export function refreshSwaggerSchema(
  url: string,
  filePath: string
): Promise<boolean>;
