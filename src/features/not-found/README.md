# Not-found feature

The body of the branded, localized 404 document that `pages/404.tsx` exports to
`out/404.html` (issue #339).

## Public API

Import the feature only through its barrel (`src/features/not-found/index.ts`); never
reach across features by deep path (enforced by `make lint-deps`).

```ts
import { NotFound } from '@/features/not-found';
```

- `NotFound` — heading, hint and a link back to the home page. Rendered by
  `pages/404.tsx`, which owns the `<Seo>` head (`noindex`, absent from the sitemap).

## Structure

- `components/not-found/` — the component, its `styles.ts` and its story.
- `i18n/` — the `not_found.*` copy (`en.json` / `uk.json`).

## Why it exists

Next.js emits a 404 document for every build; until this page existed it emitted the
framework's own unbranded, English-only default. Rendering it from `pages/` puts it inside
the shared Layout, so a visitor who mistypes a URL keeps the site header, footer and
language. The edge deliberately does not rewrite unknown URIs to it — see
[`docs/seo-surface.md`](../../../docs/seo-surface.md), "Error documents".
