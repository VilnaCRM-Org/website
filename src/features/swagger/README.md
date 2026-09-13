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

## Accessibility of the third-party widget

`swagger-ui-react` renders the servers dropdown as `<label for="servers"><select id="servers">`
with no label text, so the control had no accessible name (#424, WCAG 4.1.2). The fix is
the `wrapComponents` plugin in `components/api-documentation/servers`: `withServersLabel`
wraps the widget's `ServersContainer` with a visually-hidden `<label for="servers">`,
which names the select from anywhere in the document without patching the widget's DOM
or moving a pixel in the visual baselines. `ApiDocumentation` passes it through
`plugins={swaggerPlugins}`; the label text is `api_documentation.servers_label`. Prefer
this shape — a supported component override — over an `A11Y_EXCEPTIONS` waiver whenever
the widget exposes one.

## Internationalisation

Localized strings live in `src/features/swagger/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
