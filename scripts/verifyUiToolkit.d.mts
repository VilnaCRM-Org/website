// Declaration shim for the sibling ESM script `verifyUiToolkit.mjs`, which stays
// plain JavaScript so it runs directly under Node with no build step. The types
// let the client-layer spec import it under `allowJs: false`.
export type ReadFile = (path: string, encoding?: 'utf8') => string;

export const CHECKSUMS_PATH: string;
export const PACKAGE_ROOT: string;
export const MANIFEST_PATH: string;
export const ALGORITHM: string;

export function digest(bytes: string | Uint8Array): string;
export function readChecksums(readFile?: ReadFile): {
  algorithm: string;
  version: string;
  artifacts: Record<string, string>;
};
export function pinnedVersion(readFile?: ReadFile): string;
export function installedVersion(readFile?: ReadFile): string;
export function verify(readFile?: ReadFile): string[];
export function buildChecksumsFile(readFile?: ReadFile): {
  algorithm: string;
  version: string;
  artifacts: Record<string, string>;
};
export function main(io?: {
  readFile?: ReadFile;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}): number;
