// Declaration shim for the sibling ESM script `patchSwaggerServer.mjs`, which
// stays plain JavaScript so it runs directly under Node in the Docker build
// without a build step. Types let src/test/unit/swagger/patch-swagger.test.ts
// import it safely under `allowJs: false`.
export interface SwaggerDocument {
  [key: string]: unknown;
  servers?: Array<{ url: string; [key: string]: unknown }>;
}

export const CONTRACT_PATH: string;
export const OUTPUT_PATH: string;

export function ensureEnv(name: string): string;
export function getApiBaseUrl(): string;
export function readSwaggerSchema(path: string): SwaggerDocument;
export function patchSwaggerServerUrl(doc: SwaggerDocument, url: string): SwaggerDocument;
export function writeSwaggerSchema(path: string, doc: SwaggerDocument): string;
export function patchSwaggerServer(contractPath?: string, outputPath?: string): string;
