// Declaration shim for the sibling ESM script `verifyUiToolkit.mjs`, which stays
// plain JavaScript so it runs directly under Node with no build step. The types
// let the client-layer spec import it under `allowJs: false`.
export type ReadFile = (path: string, encoding?: 'utf8') => string;
export type DirEntry = { name: string; isDirectory: () => boolean };
export type ReadDir = (path: string, options?: { withFileTypes: true }) => DirEntry[];

export type ChecksumEntry = { path: string; sha256: string };

export type Checksums = {
  algorithm: string;
  version: string;
  tarballUrl: string;
  artifacts: ChecksumEntry[];
};

export const CHECKSUMS_PATH: string;
export const PACKAGE_ROOT: string;
export const MANIFEST_PATH: string;
export const ALGORITHM: string;

export function digest(bytes: string | Uint8Array): string;
export function listBuildFiles(readDir?: ReadDir, prefix?: string): string[];
export function readChecksums(readFile?: ReadFile): Checksums;
export function manifestSpec(readFile?: ReadFile): string;
export function pinnedVersion(readFile?: ReadFile): string;
export function installedVersion(readFile?: ReadFile): string;
export function verify(readFile?: ReadFile, readDir?: ReadDir): string[];
export function buildChecksumsFile(readFile?: ReadFile, readDir?: ReadDir): Checksums;
export function main(io?: {
  readFile?: ReadFile;
  readDir?: ReadDir;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}): number;
