# Documentation feature

A reserved feature slice for VilnaCRM product documentation.

## Status

Placeholder. The slice holds the stub body of `pages/en/docs/api.tsx` — the page that
issue #339 records as `noindex` and absent from the sitemap until it carries real content,
because a stub would compete with `/swagger` for the same query. The tracked `.gitignore`
in `i18n/` keeps that folder in git until the stub is localized.

## Public API

```ts
import { ApiDocs } from '@/features/documentation';
```

- `ApiDocs` — the placeholder heading and paragraph. Rendered by `pages/en/docs/api.tsx`,
  which owns the `<Seo>` head.

## Structure

- `components/api-docs/` — the stub component and its `styles.ts`.
- `i18n/` — reserved for localized copy (`en.json` / `uk.json`) once the page has content.

## When you build this feature

Follow the bulletproof-react layout used by the `landing` and `swagger` slices: add an
`index.ts` barrel as the only public entry point, keep components under `components/`, and
place localized copy under `i18n/`. See [`AGENTS.md`](../../../AGENTS.md) and the
`architecture` skill for the import boundaries `make lint-deps` enforces.
