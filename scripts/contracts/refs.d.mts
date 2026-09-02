// Declaration shim for the sibling ESM script `refs.mjs`, which stays plain
// JavaScript so it runs directly under Node in CI without a build step.
export function isImmutableRef(ref: string): boolean;
export function immutableRefError(ref: string): string;
export function requireImmutableUserServiceVersion(): string;
