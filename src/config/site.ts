/**
 * Build-time site identity for the SEO surface (issue #339).
 *
 * `SITE_ORIGIN` is the canonical production origin every absolute URL the site
 * publishes about itself is built from: the `rel="canonical"` link, the
 * Open Graph / Twitter `og:url` and image URLs, and the JSON-LD `WebSite` node.
 *
 * It is a committed constant rather than a `NEXT_PUBLIC_*` variable on purpose.
 * A canonical URL names the one address a document should be indexed under, so
 * it must NOT follow the host that happens to serve a given build — a sandbox
 * deploy that rewrote its canonicals to its own ephemeral host would ask
 * crawlers to index the sandbox instead of production. Making it per-environment
 * configuration would hand a preview deploy exactly that power.
 *
 * The same origin is declared once more, outside the bundle, by the `Sitemap:`
 * directive in `public/robots.txt` — a static file cannot import this module.
 * `src/test/unit/seo/sitemap.test.ts` holds the two in step (and both against
 * `docs/deployment-runbook.md`), so the duplication cannot drift.
 */
export const SITE_ORIGIN: string = 'https://vilnacrm.com';

/**
 * Absolute URL for a site-relative path, for the tags that require one.
 *
 * Canonical, `og:url` and JSON-LD URLs are all specified as absolute; a relative
 * value is either ignored or resolved against whatever host served the document,
 * which is the drift `SITE_ORIGIN` exists to prevent.
 *
 * The result is checked against `SITE_ORIGIN` rather than the input being
 * screened for the spellings that escape it. `new URL(input, base)` discards the
 * base whenever the input carries its own authority, and the ways to write one
 * are not obvious: `//host` is the familiar case, but under the WHATWG algorithm
 * a special scheme treats `\` as `/`, so `/\host` — which starts with a single
 * slash and passes any leading-`//` test — resolves to `https://host/` as well.
 * Blocklisting the forms is a guess at that list; comparing the origin the
 * parser actually produced is total, and it is the same parser the value is then
 * published through.
 *
 * Nothing passes a value from outside today. Refusing is what keeps that true as
 * callers are added, rather than a canonical URL quietly nominating another host.
 */
export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`absoluteUrl expects a site-relative path starting with "/", got: ${path}`);
  }
  const resolved: URL = new URL(path, SITE_ORIGIN);
  if (resolved.origin !== SITE_ORIGIN) {
    throw new Error(
      `absoluteUrl refused a path resolving off-origin (${resolved.origin}): ${path}`
    );
  }
  return resolved.toString();
}
