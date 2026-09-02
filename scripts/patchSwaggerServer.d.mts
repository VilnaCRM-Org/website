// Declaration shim for the sibling ESM script `patchSwaggerServer.mjs`, which
// stays plain JavaScript so it runs directly under Node during the Docker build
// without a build step. Types let src/test/unit/swagger/patch-swagger.test.ts
// import it safely under `allowJs: false`.
export interface SwaggerInfo {
  [key: string]: unknown;
  version?: string;
}

export interface SwaggerDocument {
  [key: string]: unknown;
  info?: SwaggerInfo;
  servers?: Array<{ url: string; [key: string]: unknown }>;
}

export const CONTRACT_PATH: string;
export const OUTPUT_PATH: string;

export function report(message: string): void;
export function reportError(message: string): void;
export function ensureEnv(name: string): string;
export function getApiBaseUrl(): string;
export function getUserServiceVersion(): string;
export function readSwaggerSchema(path: string): SwaggerDocument;
export function patchSwaggerServerUrl(doc: SwaggerDocument, url: string): SwaggerDocument;
export function stampUserServiceVersion(doc: SwaggerDocument, version: string): SwaggerDocument;
export function writeSwaggerSchema(path: string, doc: SwaggerDocument): string;
export function patchSwaggerSchema(contractPath?: string, outputPath?: string): string;
