// Declaration shim for the sibling ESM script `check-api-versions.mjs`, which
// stays plain JavaScript so it runs directly under Node in CI without a build
// step. Types let src/test/unit/contracts/check-api-versions.test.ts import it
// safely under `allowJs: false`.
export interface CheckApiVersionsOptions {
  /** Directory the env files and scanned config files are resolved against. */
  rootDir?: string;
  /** Env file names, relative to `rootDir`, that must all carry the same pin. */
  envFiles?: string[];
}

export const DEFAULT_ENV_FILES: string[];

/** Returns one message per broken invariant; an empty array means the pin is consistent. */
export function checkApiVersions(options?: CheckApiVersionsOptions): string[];
