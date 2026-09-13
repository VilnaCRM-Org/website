# Offline feature

The body of the offline fallback document that `pages/offline.tsx` exports to
`out/offline.html`, precached and served by `public/sw.js` when a navigation fails
(issue #338).

## Public API

Import the feature only through its barrel (`src/features/offline/index.ts`); never reach
across features by deep path (enforced by `make lint-deps`).

```ts
import { OfflineShell } from '@/features/offline';
```

- `OfflineShell` — heading, description, hint and a plain link home. Rendered by
  `pages/offline.tsx`, which owns the `<Seo>` head (`noindex`).

## Structure

- `components/offline-shell/` — the component, its `styles.ts` and its story.
- `i18n/` — the `offline.*` copy (`en.json` / `uk.json`).

## Why it is styled with `style`, not `sx`

The document is served while the network is down, so neither the emotion runtime nor the
extracted CSS bundle can load; only inline attributes serialized into the exported HTML
survive. The style objects still live in `styles.ts` and read the shared theme. The full
rationale — font stack, contrast pair, link-not-button — is in
[`docs/offline-shell.md`](../../../docs/offline-shell.md).
