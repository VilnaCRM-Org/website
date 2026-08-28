# Swagger feature

The interactive API documentation page: a Swagger UI wrapper plus its header and navigation
chrome, rendered from the committed OpenAPI contract.

## Public API

Import the feature only through its barrel (`src/features/swagger/index.ts`); never reach
across features by deep path (enforced by `make lint-deps`).

```ts
import { Swagger } from '@/features/swagger';
```

- `Swagger` — the API documentation page. Loaded client-side by `pages/swagger.tsx` through
  `next/dynamic`, since Swagger UI is browser-only.

## Structure

- `components/` — `swagger` (the root), `api-documentation`, `header`, and `navigation`.
- `hooks/` — `useSwagger.ts`, which prepares the spec/state the UI consumes.
- `assets/` — feature-local static assets.
- `i18n/` — localized copy.

## Data flow

`pages/swagger.tsx` dynamically imports the `Swagger` root, which uses `useSwagger` to load
the API specification and renders the documentation UI. The rendered spec comes from the
pinned user-service contract (see the `contract-testing-workflow` skill), so this feature is
presentation over that contract rather than a live data source.

## Internationalisation

Localized strings live in `src/features/swagger/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
