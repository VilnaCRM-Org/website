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
- `hooks/` — `useSwagger.ts`, which fetches the spec and exposes `loading`, `error` and
  `retry` to the UI.
- `assets/` — feature-local static assets.
- `i18n/` — localized copy.

## Data flow

`pages/swagger.tsx` renders `SwaggerPage`, whose dynamic import resolves the `Swagger`
root, which uses `useSwagger` to load
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

## Loading, failure and retry (issue #339)

`useSwagger` exposes `loading`, `error` and `retry` beside the spec, and
`ApiDocumentation` renders one of three states from them:

- **Loading** — the feature's `Loading` component: a spinner that is `aria-hidden` (an
  unnamed `progressbar` fails axe's `aria-progressbar-name`) beside a visually-hidden
  `role="status"` message, `api_documentation.loading`. The same component is the
  `next/dynamic` fallback while the chunk downloads.
- **Failed** — a `role="alert"` carrying `api_documentation.error.message` and, outside
  the alert so its state changes are not re-announced assertively, a "Try again" button
  described by the message through `aria-describedby`. The raw `error.message` is never
  rendered: it is transport wording, not user copy. The first failure does not move
  focus (a status message on page load is not the user's action); a failure after a
  user-initiated retry focuses the button, because it unmounted during the reload and
  focus would otherwise fall to `<body>`.
- **Loaded** — `SwaggerUI`, plus a persistent visually-hidden `role="status"` region that
  flips to `api_documentation.loaded`, so a screen-reader user hears that the retry
  worked. The region exists in every state; content changes on an existing live region
  are announced reliably, a region mounted with content is not.

The failed state is composed DOM no initial-load scan sees, so it is registered as
`swaggerLoadFailed` in `src/test/a11y/interaction-states.ts` and driven by
`src/test/e2e/swagger/swagger-section.spec.ts`, which aborts `/swagger-schema.json`,
scans the state, then lifts the abort and proves the retry renders the documentation.

## Reserving the viewport while the page loads (issue #493)

The header and footer are `ssr: false` chunks, and so is this page's `Swagger` root, so
nothing on `/swagger` has a height until the client renders it. The `Loading` spinner used
to be zero-height, which left the footer sitting right under the header. Every later state
(the `Swagger` wrapper with its back link, then the documentation or the failed state)
pushed the footer down. Desktop Lighthouse measured that shift on `footer#Contacts` in every
sample: 0.0269, plus a second shift of 0.0176 in most samples, against a 0.05 ceiling.
Mobile measured 0.10 and 0.14 in run 35979329666. The baseline comment in
`lighthouserc.desktop.js` records the distribution. Two styles keep the footer below the
fold through each transition:

- `loading/styles.ts` gives the `role="status"` container `minHeight: 100vh` and
  `position: relative`. The spinner and its visually hidden label are absolutely
  positioned, so they now centre in the reserved box and cannot overlap the footer. That
  covers the `next/dynamic` fallback, which renders outside the wrapper.
- `swagger/styles.ts` holds the wrapper at `minHeight: 100vh` for as long as it contains no
  `.swagger-ui` element (`:not(:has(.swagger-ui))`). That covers the failed state, which is
  shorter than a viewport, and the frame where `swagger-ui-react` has mounted but still
  renders `null` while its `useEffect` builds the system. After that frame, `Loading` is
  gone, so only the wrapper holds the footer down.

Only `min-height` is used, never `height` or `overflow`. Enlarged text at 400% zoom can
still grow the box, and reflow at 320px only adds vertical scroll. The reservation is
released as soon as Swagger UI renders, and releasing it matters.
`src/test/visual/swagger` resizes the viewport to the page's `scrollHeight` before its
full-page screenshot, so a `100vh` that persisted into the loaded state would grow the
page to match and move every baseline. The loaded documentation is taller than a desktop
or mobile Lighthouse viewport, so releasing the reservation moves the footer only while it
is off-screen. `src/test/testing-library/SwaggerComponents.test.tsx` checks all three states.

### What the Lighthouse gate does not see yet

Every `/swagger` sample above is the failed state. `make lighthouse-desktop` and
`make lighthouse-mobile` run with `EXEC_MODE=host` in `performance-testing.yml`. On that
path `LHCI_RUN` in the `Makefile` is `$(NEXT_BUILD_CMD) && $(LHCI)`, and neither half runs
`scripts/patchSwaggerServer.mjs`. Only the `Dockerfile` build does. The script writes the
gitignored `public/swagger-schema.json`, so the host export ships without it, the fetch
returns 404, and Lighthouse audits `LoadError`. So the CLS number CI reports for `/swagger`
does not cover two things this fix relies on: the reservation being released when
`.swagger-ui` mounts, and the loaded documentation being taller than the audit viewport.
The component spec pins the first. Nothing pins the second. The fix is to run
`node scripts/patchSwaggerServer.mjs` ahead of the host `LHCI_RUN`, with a Bats case that
pins it. That `Makefile` change, and re-calibrating the `/swagger` budgets against the
loaded page, are tracked in #498; until it lands, read a green `/swagger` assertion as a
measurement of the failed state.

The loading state has no Figma frame. It is a centred spinner on the page background with
no design of its own, and the visual baselines capture only the loaded state.

## The back link

`components/navigation` is a `next/link` anchor to `/`, named by its visible text ("To
the main page") with a decorative arrow. It used to be a clickable `Box` calling
`window.location.assign('/')` — not focusable, not keyboard-operable, and a
`role="navigation"` landmark nested inside it. There is no `nav` landmark now: one
link is not a navigation block, and the header already owns the page's landmark.
Do not add an `aria-label` — `label-content-name-mismatch` is force-enabled in
`src/test/a11y/axe-config.ts`, so the name must come from the content.

## Internationalisation

Localized strings live in `src/features/swagger/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
