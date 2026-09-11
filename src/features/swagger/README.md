# Swagger feature

The interactive API documentation page: a Swagger UI wrapper plus its header and navigation
chrome, rendered from the committed OpenAPI contract.

## Public API

Import the feature only through its barrel (`src/features/swagger/index.ts`); never reach
across features by deep path (enforced by `make lint-deps`).

```ts
import { SwaggerPage } from '@/features/swagger';
```

- `SwaggerPage` — the API documentation page behind its own lazy boundary. It wraps the
  `Swagger` root in `next/dynamic` (`ssr: false`, since Swagger UI is browser-only) and
  renders the feature's `Loading` spinner while the chunk downloads. The barrel exposes
  **only** this wrapper on purpose: a static re-export of `Swagger` would pull
  `swagger-ui-react` into the initial chunk of any page importing the barrel, defeating
  the split. Tests that need the root import
  `components/swagger/swagger` by path.

## Structure

- `components/` — `swagger-page` (the lazy boundary), `swagger` (the root), `loading`
  (the spinner shown while the chunk loads), `api-documentation`, `header`, and
  `navigation`.
- `hooks/` — `useSwagger.ts`, which prepares the spec/state the UI consumes.
- `assets/` — feature-local static assets.
- `i18n/` — localized copy.

## Data flow

`pages/swagger.tsx` renders `SwaggerPage`, whose dynamic import resolves the `Swagger`
root, which uses `useSwagger` to load
the API specification and renders the documentation UI. The rendered spec comes from the
pinned user-service contract (see the `contract-testing-workflow` skill), so this feature is
presentation over that contract rather than a live data source.

## Internationalisation

Localized strings live in `src/features/swagger/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
