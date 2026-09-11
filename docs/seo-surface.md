# The SEO surface

How the public site describes itself to crawlers and link previews, and why each part is
shaped the way it is. The gates that keep it from drifting are listed in `CLAUDE.md`
("The SEO surface"); this note is the design rationale that used to sit in the source
(issue #339, ADR 0005).

## What was wrong before #339

Every route shipped one generic `<title>` (`header.layout.page_title`, "VilnaCRM API"),
two competing meta descriptions — a hardcoded English one in `pages/_document.tsx`,
rendered outside `next/head`'s de-duplication, alongside the localized one from the shared
Layout — and no canonical, Open Graph, Twitter Card or structured data at all. In a search
result the marketing site was indistinguishable from its own API docs, and a shared link
rendered as bare text.

## Per-page head: `src/components/seo`

`Seo` renders the title, the single description, the canonical link, the Open Graph and
Twitter tags and, on the home page alone, the JSON-LD graph.

- **It overrides the Layout, on purpose.** `src/components/layout` still declares the
  site-wide title and description so a route that renders no `Seo` is never title-less.
  `next/head` reverses the collected head elements before de-duplicating, so for
  `<title>` and for a `<meta name>` the _last_ declaration wins — and a page renders as a
  child of Layout. That ordering is what makes the page's declaration authoritative.
- **`_document` declares no description.** `_document` renders outside `next/head`, so
  its tags are never de-duplicated against a page's; the old hardcoded English description
  rendered alongside the localized one and gave every page two.
- **Canonical and `noindex` are exclusive.** A canonical link nominates the URL a document
  should be indexed under; declaring one on a page that also asks not to be indexed hands
  a search engine two contradictory instructions and leaves the choice to it. A `noindex`
  page states only that. The 404 and offline documents, and the `/en/docs/api` stub, are
  `noindex` and absent from `public/sitemap.xml`: an indexed error report or placeholder
  is only ever a dead result, and a stub competes with `/swagger` for the same query.
- **The home page alone declares the site graph.** `Organization` and `WebSite` describe
  the site as a whole; repeating them on every route would only restate the same two
  nodes.
- **`og:locale` is a full locale, not a language subtag.** The two locales the i18n
  bundles carry map to `en_US` / `uk_UA`; an unrecognised value falls through to the
  language code itself rather than to a wrong-but-well-formed guess. The mapping strips a
  region with `replace` rather than `split(...)[0]` because under
  `noUncheckedIndexedAccess` the indexed read is `string | undefined`, and the `??`
  needed to narrow it is a branch no input can take — exactly what the integration
  layer's 100% sweep fails on.
- **`src/components` imports nothing from `src/features`** (dependency-cruiser
  `no-shared-ui-to-features`): the copy is passed in by the page, which reads it from its
  own feature i18n bundle.

### Social tags are an array, not a component

`socialMetaTags` in `social-tags.tsx` is a plain function returning an array of elements.
`next/head` inspects the elements it is handed and turns each into a DOM node itself; a
custom component among its children would be treated as a tag named after the function.
Only real tags, fragments and arrays survive that pass. Keeping the tag set out of `Seo`
is also what holds that function inside the `config/metrics-policy.json` size and
Halstead budgets.

There is no `og:image` / `twitter:image`, and the card type is `summary` rather than
`summary_large_image`: the repository ships no designed share card — its largest raster
asset is a 180px touch icon — and a card pointing at a blurred favicon, or at a file the
export does not contain, renders worse than the text-only fallback. Both upgrade together
in the change that adds a real 1200x630 asset.

### Structured data

`structured-data.ts` builds two nodes in one `@graph`, which is how a single script tag
expresses more than one entity: `Organization` (who publishes the site) and `WebSite` (the
site as a work), cross-referenced by `@id` rather than nested so a consumer that only
understands one of them still reads a complete node.

`sameAs` is deliberately absent. It links the `Organization` to its profiles on other
services and a search engine treats it as an identity claim; pointing it at the placeholder
profile URLs the site still carries (`src/config/social-links.ts` holds bare
`instagram.com` / `facebook.com` / `linkedin.com` homepages, tracked in #327) would publish
a claim that is simply false. It is added in the same change that replaces those
placeholders with real profiles.

The JSON is embedded as a **text child** of the `<script>`, not through
`dangerouslySetInnerHTML`. React does not HTML-escape the text content of a `<script>`
element, and `next/head` assigns a string child straight to `textContent`, so the JSON
reaches the parser unaltered — no `&quot;` to corrupt it, and no dangerous-property
finding to suppress. What keeps it safe is `buildSiteStructuredData` escaping every `<`
to its `\u003c` JSON form: the same character to a JSON parser, inert to an HTML
tokenizer, so no value can close the element early and inject markup. React's own
serializer escapes a literal `</script` as well, but that is defence in depth, not the
guarantee — it does not run for the client-side render.

## One canonical origin: `src/config/site.ts`

`SITE_ORIGIN` is the canonical production origin every absolute URL the site publishes
about itself is built from: the `rel="canonical"` link, `og:url`, and the JSON-LD
`WebSite` node.

It is a committed constant rather than a `NEXT_PUBLIC_*` variable. A canonical URL names
the one address a document should be indexed under, so it must not follow the host that
happens to serve a given build — a sandbox deploy that rewrote its canonicals to its own
ephemeral host would ask crawlers to index the sandbox instead of production. The same
origin is declared once more, outside the bundle, by the `Sitemap:` directive in
`public/robots.txt` (a static file cannot import this module);
`src/test/unit/seo/site-origin.test.ts` holds the two, and `docs/deployment-runbook.md`,
in step.

`absoluteUrl(path)` exists because canonical, `og:url` and JSON-LD URLs are all specified
as absolute; a relative value is either ignored or resolved against whatever host served
the document, which is the drift `SITE_ORIGIN` exists to prevent. The result is checked
**against `SITE_ORIGIN`** rather than the input being screened for the spellings that
escape it. `new URL(input, base)` discards the base whenever the input carries its own
authority, and the ways to write one are not obvious: `//host` is the familiar case, but
under the WHATWG algorithm a special scheme treats `\` as `/`, so `/\host` — a single
leading slash, passing any leading-`//` test — resolves to `https://host/` as well.
Blocklisting the forms is a guess at that list; comparing the origin the parser actually
produced is total, and it is the same parser the value is then published through. Nothing
passes a value from outside today; refusing is what keeps that true as callers are added.

## Error documents

`pages/404.tsx` gives the export a branded, localized `404.html` (rendered inside the
shared Layout, so a visitor who mistypes a URL keeps the header, footer and language).
`scripts/cloudfront_routing.js` does **not** rewrite unknown URIs to it: a viewer-request
function can only rewrite the URI or return a response of its own, and a rewrite would
serve the page with a `200` — the soft 404 that tells a crawler the address is real. The
edge keeps returning its synthetic `404` (asserted on every deploy by
`scripts/ci/smoke-response-shape.sh`); this document is what S3 serves as the bucket's
error document and what the dev server renders.
