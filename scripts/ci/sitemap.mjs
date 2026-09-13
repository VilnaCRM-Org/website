/**
 * Pure sitemap construction for `public/sitemap.xml` (issue #339).
 *
 * Split from the `generate-sitemap.mjs` CLI for the reason the contract linter was split
 * in #348: a module that resolves its own paths through `import.meta` and exits the process
 * on a bad input cannot be driven by a spec — Jest transforms these files to CJS, where
 * `import.meta` does not exist — so the rules would only ever be exercised through the one
 * committed artifact that already satisfies them. Everything here is a pure function over
 * its arguments that THROWS on bad input, so `src/test/unit/seo/sitemap.test.ts` can hold
 * each rule against inputs the repository does not contain.
 */

/**
 * Exported routes deliberately kept out of the sitemap, each with its reason. A sitemap is
 * a request to index, so every entry has to be a page a search result should be able to
 * land on. The spec asserts each excluded route still exists in the route manifest, so an
 * exclusion cannot outlive the page it was written for.
 */
export const EXCLUDED_ROUTES = Object.freeze({
  '/offline':
    'The PWA fallback shell (#338) is served from the service-worker cache when a ' +
    'navigation fails; it is a network artefact rather than content, and ships noindex.',
  '/en/docs/api':
    'Still the placeholder stub recorded in #339. It ships noindex, because asking a ' +
    'crawler to index a stub competes with /swagger — the page carrying the real API ' +
    'reference — for the same query.',
});

/**
 * The origin declared by the `Sitemap:` directive in `public/robots.txt`.
 *
 * Comment lines are dropped first: the file explains its own history and legitimately
 * mentions a hostname it no longer points at, so a commented example must never be able to
 * become the origin every URL in the sitemap is built from.
 */
export function readOriginFromRobots(contents) {
  const values = contents
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .filter(line => line.toLowerCase().startsWith('sitemap:'))
    .map(line => line.slice('sitemap:'.length).trim());
  if (values.length !== 1) {
    throw new Error(`expected exactly one Sitemap directive in robots.txt, found ${values.length}`);
  }
  return new URL(values[0]).origin;
}

// `&`, `<` and `>` are the three characters that would otherwise be read as markup inside a
// `<loc>`; `"` and `'` are escaped too so the same helper stays correct if a value ever
// moves into an attribute. No route contains any of them today — which is the point: the
// escape is here so that the day one does, the sitemap stays well-formed rather than
// unparseable.
export function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the sitemap document from the route manifest's routes and the canonical origin.
 *
 * No `<lastmod>`: a build-time timestamp would change the file on every run, so the
 * committed artifact could never be checked for drift, and it would claim a modification
 * date reflecting when the sitemap was regenerated rather than when the page changed. No
 * `<changefreq>` or `<priority>` either — both are hints the major crawlers state they
 * ignore.
 */
export function buildSitemap(routes, origin) {
  const included = [...new Set(routes)]
    .filter(route => !Object.hasOwn(EXCLUDED_ROUTES, route))
    .sort();
  if (included.length === 0) {
    throw new Error('every known route is excluded; the sitemap would index nothing');
  }
  const entries = included
    .map(route => {
      const loc = escapeXml(new URL(route, origin).toString());
      return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
    })
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}
