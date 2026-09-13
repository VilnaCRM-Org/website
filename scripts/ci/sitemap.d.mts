// Declaration shim for the sibling ESM module `sitemap.mjs`, which stays plain
// JavaScript so it runs directly under Node in CI with no build step and no
// node_modules. Types let src/test/unit/seo/sitemap.test.ts import it under
// `allowJs: false`.

/** Exported routes deliberately kept out of the sitemap, keyed by route, valued by reason. */
export const EXCLUDED_ROUTES: Readonly<Record<string, string>>;

/** The origin of the single uncommented `Sitemap:` directive. Throws if there is not exactly one. */
export function readOriginFromRobots(contents: string): string;

/** Escape the five XML metacharacters. */
export function escapeXml(value: string): string;

/** Build the sitemap document. Throws when every supplied route is excluded. */
export function buildSitemap(routes: readonly string[], origin: string): string;
