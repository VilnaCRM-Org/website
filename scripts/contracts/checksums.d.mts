// Declaration shim for the sibling ESM script `checksums.mjs`, which stays plain
// JavaScript so it runs directly under Node in CI without a build step. Types let
// src/test/unit/contracts/contract-checksums.test.ts import it safely under
// `allowJs: false`.
export type ReadFile = (path: string, encoding: 'utf8') => string;

export const CHECKSUMS_PATH: string;
export const OPENAPI_ARTIFACT: string;
export const SCHEMA_ARTIFACT: string;
export const ALGORITHM: string;

export function digest(text: string): string;
export function canonicalizeOpenapiDocument(doc: unknown): string;
export function openapiDigestFromJson(jsonText: string): string;
export function openapiDigestFromYaml(yamlText: string): string;
export function graphqlDigest(sdl: string): string;
export function readChecksums(readFile?: ReadFile): Record<string, string>;
export function computeCommittedDigests(readFile?: ReadFile): Record<string, string>;
export function verifyCommittedDigests(readFile?: ReadFile): string[];
export function buildChecksumsFile(readFile?: ReadFile): {
  comment: string;
  algorithm: string;
  artifacts: Record<string, string>;
};
