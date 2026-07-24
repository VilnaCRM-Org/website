// Declaration shim for the sibling ESM script `fetchGraphqlSchema.mjs`, which
// stays plain JavaScript so it runs directly under Node in CI without a build
// step. Types let src/test/unit/swagger/fetch-graphql.test.ts import it safely
// under `allowJs: false`.
export function buildSchemaUrl(): string;
export function fetchGraphqlSchema(url: string): Promise<string>;
export function saveGraphqlSchema(sdl: string, filePath: string): Promise<void>;
export function refreshGraphqlSchema(
  url: string,
  filePath: string
): Promise<boolean>;
