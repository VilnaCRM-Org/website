# ADR 0006: The locale is a function of the route, under a static `/en` prefix

- **Status:** Accepted
- **Date:** 2026-09-14
- **Deciders:** website maintainers
- **Related:** ADR 0001, ADR 0005, issue #333, issue #339

## Context

The site ships two complete translation bundles, `uk` and `en`, and has linked to `/en`
as "the English version" since the CloudFront routing table was first written. The link
never worked. Until #333 the edge rewrote `/en` to `/en/index.html`, an object the export
never produced, and leaked a raw S3 error; #333 removed the entry, so `/en` returned the
synthetic 404 instead. Behind the link there was nothing to serve: no `pages/en/index.tsx`,
no `i18n` block in `next.config.js`, and an i18next instance initialised once with
`NEXT_PUBLIC_MAIN_LANGUAGE` and never told anything else. The only page that rendered in
English did so through a `changeLanguage('en')` effect inside the swagger component — a
side effect that also left the landing page English after a visit to `/swagger`, and
rendered English copy under `<html lang="uk">` (WCAG 3.1.1).

The options that were actually available under ADR 0001:

- **Next's built-in i18n routing.** Ruled out by the platform: it is one of the features
  `output: 'export'` does not support, and the export is the delivery model.
- **A dynamic `pages/[locale]/` segment with `getStaticPaths`.** Works with the export, but
  `scripts/ci/generate-route-manifest.mjs` refuses a dynamic segment on purpose — the
  manifest is the derived truth every route gate (edge `ROUTE_MAP`, the a11y registry,
  the sitemap) is held to, and a dynamic route has no single exported object to hold
  them to.
- **Client-side language selection only** (a detector or a switcher, no route). Leaves
  `/en` a 404, gives crawlers no English page to index, and flashes the main language
  before the switch.
- **A static locale directory under `pages/`** with the language derived from the
  pathname at render time. Every gate already understands it: the manifest generator's
  own example is `pages/en/index.tsx -> /en`.

## Decision

We derive the language of every route from its pathname, and the English landing is the
ordinary page `pages/en/index.tsx`.

- `src/config/locales.ts` holds the one rule: `/en` and everything beneath it is `en`;
  `/swagger` is `en` because the OpenAPI reference it embeds is English-only; everything
  else is `NEXT_PUBLIC_MAIN_LANGUAGE`. The same module resolves the landing a route
  belongs to (`landingPathOf`), so internal navigation never leaves the locale prefix,
  and declares the `hreflang` alternates the two landings publish.
- `src/hooks/use-route-i18n.ts` applies it once, at the routing root. It hands
  `I18nextProvider` a **clone** of the i18next instance bound to the route's language —
  so the exported HTML is already in that language and hydration matches — and syncs
  `<html lang>`, `dir` and the global instance in an effect, because React never
  reconciles the root element and the validators and the Apollo `Accept-Language` link
  read `i18next` directly. The sync is never done during render: `changeLanguage` notifies
  every mounted subscriber, and doing that inside another component's render is a React
  error and a mixed-language first frame.
- `pages/_document.tsx` derives `<Html lang>` from the same function through
  `__NEXT_DATA__.page`, so the document language, the copy, `og:locale` and the alternates
  cannot disagree. `dir` is pinned there as a static `"ltr"`, not derived per route, because
  both shipped locales are left-to-right; a future right-to-left locale must extend that
  attribute rather than assume it stays constant.
- The route is registered like any other: `config/routes.json`, `ROUTE_MAP` and a
  root-level `ALLOWED_FILES` entry for the flat `/en.html`, the a11y route registry (which
  now also asserts the language of every route), and the sitemap.

Out of scope, deliberately: a visible language switcher, a `/uk` prefix (the root is the
Ukrainian page and the `x-default`), and locale-prefixed copies of `/swagger` or
`/offline`.

## Consequences

### What this buys

`/en` is a real, indexable, exported English page with a correct document language, and
it cannot drift back: the manifest, edge, a11y and sitemap gates that #333 and #339 built
all fail closed on a locale page that is added without being registered. The language
rule has exactly one home, so the swagger component no longer owns a side effect, and a
third locale is a new prefix in one file plus the same page checklist.

### What this costs

- **Two exported copies of the landing.** `out/index.html` and `out/en.html` are built,
  scanned and audited separately; the a11y route sweep and the sitemap each grew by one
  entry, and the contrast waiver in `src/test/a11y/axe-config.ts` had to be extended to
  `/en` because it is the same DOM under the same palette (#423).
- **A locale change remounts the tree.** `I18nextProvider` is keyed by locale so that a
  client-side navigation between `/` and `/en` never paints a mixed-language frame; the
  price is that the header, footer and page remount on that navigation. It is the correct
  behaviour for a language switch and it is rare — only the logo link out of `/swagger`
  crosses locales today — but a same-page toggle would need to accept it.
- **Two i18next instances exist at runtime.** The clone shares the resource store, but
  code that imports `t` from `i18next` directly sees the route language only after the
  first effect. Everything that does so today runs on user interaction, which is late
  enough; a render-time consumer of the global instance would be a bug.
- **The rule is prefix-based, not language-based.** `/swagger` renders in English but its
  logo and anchors resolve to `/`, because the visitor did not choose a locale to reach
  it. That is documented in `docs/extending-the-website.md` and pinned by the header and
  route-locale specs; it will look inconsistent to anyone who expects "English page,
  English home".

### What would reverse it

Next supporting i18n routing under `output: 'export'`, or the site leaving the static
export (ADR 0001) for a runtime that can negotiate `Accept-Language`. A third locale
would not reverse it, but a locale that needs right-to-left layout would test the
`dir` sync and the MUI theme in ways this decision has not.
