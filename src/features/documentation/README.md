# Documentation feature

The English-language documentation entry point for the VilnaCRM product.

## Status

Live. `pages/en/docs/api.tsx` renders this feature's `ApiDocs` component at
`/en/docs/api`. The page orients an English-speaking reader and sends them to the
interactive, always-current API reference at `/swagger` — it does not restate API facts
that only `/swagger`'s generated reference can back up. It stays `noindex` and out of
`public/sitemap.xml` (see `scripts/ci/sitemap.mjs`): a thin page whose whole purpose is to
point at `/swagger` would only compete with it for the same search query.

## Public API

```ts
import { ApiDocs } from '@/features/documentation';
```

- `ApiDocs` — the heading, orienting copy, and the link to `/swagger`. Rendered by
  `pages/en/docs/api.tsx`, which owns the `<Seo>` head.

## Structure

- `components/api-docs/` — the component and its `styles.ts`.
- `i18n/` — localized copy (`en.json` / `uk.json`). The route is English-only by design
  (`src/config/locales.ts`), but both locales are kept in parity with the rest of the
  codebase's convention, the same way `src/features/swagger/i18n/` keeps a `uk.json` for
  its own English-only route.

## When you extend this feature

Follow the bulletproof-react layout used by the `landing` and `swagger` slices: the
`index.ts` barrel stays the only public entry point, components live under `components/`,
and localized copy lives under `i18n/`. See [`AGENTS.md`](../../../AGENTS.md) and the
`architecture` skill for the import boundaries `make lint-deps` enforces.
