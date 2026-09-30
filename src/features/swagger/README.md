# Swagger feature

The interactive API documentation page: a Swagger UI wrapper plus its header and navigation
chrome, rendered from the committed OpenAPI contract.

## Public API

Import the feature only through its barrel (`src/features/swagger/index.ts`); never reach
across features by deep path (enforced by `make lint-deps`).

```ts
import { SwaggerPage } from '@/features/swagger';
```

- `SwaggerPage` — the API documentation page: the schema preload plus the `Swagger` root.
  The root renders the page wrapper and the back link directly and loads only
  `ApiDocumentation` through `next/dynamic` (`ssr: false`, since Swagger UI is
  browser-only), rendering the feature's `Loading` spinner while that chunk downloads. So
  `swagger-ui-react` stays out of the page's initial chunk while the wrapper and the back
  link are in the prerendered HTML. The barrel still exposes only `SwaggerPage`; tests that
  need the root import `components/swagger/swagger` by path.

## Structure

- `components/` — `swagger-page` (the page and its schema preload), `swagger` (the root and
  the lazy boundary around `api-documentation`), `loading` (the spinner shown while the
  chunk and the schema load), `api-documentation`, `header`, and
  `navigation`.
- `hooks/` — `useSwagger.ts`, which fetches the spec and exposes `loading`, `error` and
  `retry` to the UI.
- `helpers/` — pure helpers, among them `lowlight-compat.ts`, the highlighter engine shim
  described below.
- `assets/` — feature-local static assets.
- `i18n/` — localized copy.

## Syntax-highlighter engine (issue #379)

Every highlighted block on the page — example bodies, the live response, the curl
snippets — comes from `react-syntax-highlighter`'s light build inside `swagger-ui-react`.
That build imports lowlight 1, which pins the end-of-life highlight.js 10. `next.config.js`
aliases the request `lowlight/lib/core` (webpack and Turbopack alike) to
`helpers/lowlight-compat.ts`, which offers the same four functions over lowlight 3 and
highlight.js 11, and `package.json` overrides both packages. Nothing in the feature
imports the shim; the alias is its only caller. Before bumping `swagger-ui-react` or
`react-syntax-highlighter`, re-read how the light build uses lowlight — the contract and
the retirement trigger are in [ADR 0015](../../../docs/adr/0015-swagger-highlighter-engine-shim.md)
and [docs/swagger-highlighter-surface.md](../../../docs/swagger-highlighter-surface.md).

## Data flow

`pages/swagger.tsx` renders `SwaggerPage`, which renders the `Swagger` root, whose dynamic
import resolves `ApiDocumentation`, which uses `useSwagger` to load the API specification
and renders the documentation UI. The rendered spec comes from the
pinned user-service contract (see the `contract-testing-workflow` skill), so this feature is
presentation over that contract rather than a live data source.

## Accessibility of the third-party widget

`swagger-ui-react` ships four WCAG failures that are fixed through its supported
`wrapComponents` plugin API rather than waived or patched in the DOM. `ApiDocumentation`
passes them as `plugins={swaggerPlugins}`, the list in `components/api-documentation/plugins`:

- `servers` — `withServersLabel` wraps `ServersContainer` with a visually-hidden
  `<label for="servers">`, because the widget's own label around the servers select is
  empty (#424, SC 4.1.2). Text: `api_documentation.servers_label`.
- `authorize-dialog` — `withCloseLabel` wraps `CloseIcon` so the icon-only `.close-modal`
  button is named by the svg (`role="img"`, `aria-hidden` removed, text
  `api_documentation.authorize_dialog.close`), and `withLabelInName` wraps `Button` so a
  button with string children ("Authorize", "Logout") is named by that visible text
  instead of a different `aria-label` (#433, SC 4.1.2 and 2.5.3).
- `responses-table` — wraps `responses` with an owned port of the OAS3 responses table:
  `<th scope="col">` header cells and no `role="region"` override on the `<table>`, with the
  id, classes and `aria-live` kept (#433, SC 1.3.1). It renders inside swagger-ui's error
  boundary (`system.fn.withErrorBoundary`) and delegates to the original for non-OAS3 specs.
  Its copy ("Responses", "Code", "Description", "Links") stays upstream's English, like the
  rest of the widget on this English-only route. The live "Server response" table is not
  ported yet; `docs/accessibility/acceptance-standard.md` records that follow-up.

The ported table is pinned to `swagger-ui-react`'s `responses.jsx` at 5.32.6, and
`SwaggerResponsesTable.test.tsx` fails on any other installed version: on every upgrade,
re-diff the port against the new `responses.jsx` by hand before moving that pin. No other gate
catches that drift, because the port replaces upstream's markup, so an upstream change to the
table never reaches the DOM the scans read. With the waivers deleted, the e2e interaction
scans fail closed only when an upgrade renames `CloseIcon`, `Button` or `responses` or
reorders the icon's props; port the change, never re-add a waiver. Prefer this shape — a
supported component override — over an `A11Y_EXCEPTIONS` waiver whenever the widget exposes
one.

## Load performance

One more entry in `swaggerPlugins` changes no markup; it removes duplicate work
`swagger-ui-react` 5.32.6 does on every load. `specLoadPlugin` (`components/api-documentation/spec-load`)
wraps two spec actions:

- `updateSpec` drops a call whose string equals the stored `specStr`. The core constructor
  already parses an object `spec`, and the React wrapper's effect then re-sends the same JSON.
  `swagger-ui-react` also registers the `apis` preset twice, so every `updateSpec` parses the
  document twice: the page parsed it four times, and dropping the re-send halves that to two.
  Deduplicating `parseToJson` as well was measured against the real core and left out, because
  the remaining parse costs a few milliseconds.
- `requestResolvedSubtree(["components","securitySchemes"])` stores the subtree as its own
  resolved form through swagger-ui's `updateResolvedSubtree` when it holds no `$ref` and no
  `openIdConnect` scheme, instead of running the resolver. The result is identical, but for
  an OpenAPI 3.1 document swagger-client first normalizes the entire spec through ApiDOM,
  which was the longest task on the page (about 190 ms locally, 230-360 ms on CI runners).
  Storing, rather than skipping, keeps `resolvedSubtrees` as upstream sets it: the OAS3
  `definitionsToAuthorize` selector passes that subtree as an argument to refresh its cached
  Authorize data. Operations and models still resolve when they are expanded.

`SwaggerPage` also preloads `/swagger-schema.json` from the static HTML
(`<link rel="preload" as="fetch" crossorigin="anonymous">`, the credentials mode `fetch()`
uses), so the request no longer waits for the swagger chunks to download and execute. WebKit
does not hand an `as=fetch` preload to `fetch()`, so Safari downloads the schema twice and logs
an unused-preload warning; that is expected, not a regression. Both
changes exist because the desktop Lighthouse floor on this route stays at 0.85 (a protected,
raise-only threshold) once issue #498 made CI audit the loaded page. The plugin depends on
swagger-ui's action names, so re-check it on every `swagger-ui-react` upgrade together with
the ported responses table.

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

## Reserving the viewport while the page loads (issues #493, #446)

The header and footer are `ssr: false` chunks, and so is `ApiDocumentation`, so most of
`/swagger` has no height until the client renders it. The `Loading` spinner used to be
zero-height, which left the footer sitting right under the header. Every later state pushed
the footer down. Desktop Lighthouse measured that shift on `footer#Contacts` in every
sample: 0.0269, plus a second shift of 0.0176 in most samples, against a 0.05 ceiling.
Mobile measured 0.10 and 0.14 in run 35979329666. The baseline comment in
`lighthouserc.desktop.js` records the distribution.

User-service v0.8.0 (#446) made the loaded page 2968px tall at 1350px instead of 1348px, and
desktop CLS rose from 0.048 to 0.057 (run 36715605941). Replaying the load in Chromium and
reading the `layout-shift` entries' sources showed two causes, both older than v0.8.0:

- **The header had no placeholder.** The prerendered `Loading` status painted at the top of
  the page and moved down 64px (56px on mobile) when the header chunk mounted. That is the
  0.0453 shift Lighthouse attributes to the `role="status"` container, identical on `main`.
- **The footer's shadow reached into the viewport.** The footer sat at header + 100vh, which
  is 1004px, and its `0 -5px 46px` shadow paints about 74px above its box. That left the
  bottom 10px of the viewport inside the shadow, and every height change above it counted:
  the chunk swap (fallback `Loading`, then the wrapper with the back link and a second
  `Loading`, 69px taller), then the frame where `swagger-ui-react` renders `null`, then the
  documentation. That produced two shifts of 0.00054 and a last one of
  `10 / 940 × min(distance / 1335, 1)` (1335px is the viewport width beside the
  scrollbar). The last one grew from 0.0017 to 0.0106 only because
  the taller v0.8.0 page moves the footer farther.

What keeps the page still now:

- `pages/_app.tsx` passes `HeaderPlaceholder` (`src/components/header-placeholder`) as the
  header's `next/dynamic` `loading` element. It reserves `theme.mixins.toolbar`, the same
  rule the header's MUI `Toolbar` applies (56px, 48px in landscape, 64px from `sm`), so the
  swap moves nothing below it. This covers every route, not only this one.
- `Swagger` renders the grey wrapper, the container and the back link itself and puts
  `next/dynamic` around `ApiDocumentation` only. The prerendered HTML already holds
  everything above the documentation, so nothing above it changes height when a chunk
  arrives.
- `loading/styles.ts` gives the `role="status"` container `minHeight: 100vh` and
  `position: relative`. The spinner and its visually hidden label are absolutely
  positioned, so they centre in the reserved box and cannot overlap the footer. The
  `next/dynamic` fallback and the in-component loading state are the same component in the
  same place, so they have the same height.
- `api-documentation/styles.ts` holds the `ApiDocumentation` region at `minHeight: 100vh`
  while it contains no `.swagger-ui` element (`:not(:has(.swagger-ui))`). That covers the
  failed state, which is shorter than a viewport, and the frame where `swagger-ui-react` has
  mounted but still renders `null`. The reservation used to sit on the wrapper, which also
  holds the back link, so the wrapper shrank by the back link's height in that frame.

From the first paint until the documentation renders, the footer now sits at header + the
wrapper's top padding + the back link + 100vh: 1073px on a 940px desktop viewport and
937px on an 823px mobile one. Its shadow stays below the fold in both, so the final jump to
the bottom of the documentation starts and ends off-screen. In that Chromium replay, every
layout-shift entry was gone on `/swagger` at 1350×940 and 412×823, the loaded page kept its
height (2968px and 3533px), and `/` stayed at zero.

Only `min-height` is used, never `height` or `overflow`. Enlarged text at 400% zoom can
still grow the box, and reflow at 320px only adds vertical scroll. The reservation is
released as soon as Swagger UI renders, and releasing it matters.
`src/test/visual/swagger` resizes the viewport to the page's `scrollHeight` before its
full-page screenshot, so a `100vh` that persisted into the loaded state would grow the
page to match and move every baseline. `src/test/testing-library/SwaggerComponents.test.tsx`
checks each state, and `HeaderPlaceholder.test.tsx` holds the placeholder to the toolbar's
height.

### What the Lighthouse gate sees

The #493 samples above measured the failed state: the host `LHCI_RUN` in the `Makefile`
did not run `scripts/patchSwaggerServer.mjs`, so `/swagger-schema.json` returned 404.
Since issue #498 it runs the script first (`LHCI_PATCH_SWAGGER`), so the `/swagger` samples
now measure the loaded documentation, including the reservation being released when
`.swagger-ui` mounts and the jump of a footer that starts off-screen. The #446 numbers above
are loaded-state samples.

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
