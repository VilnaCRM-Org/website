---
name: frontend-performance-accessibility
description: >-
  Use when tuning website frontend performance or accessibility — running
  make lighthouse-desktop / make lighthouse-mobile, reading lighthouserc
  desktop/mobile budgets, reasoning about Core Web Vitals (LCP, CLS, INP),
  fixing MUI 9 / next-export-optimize-images layout shift, writing accessible
  markup (accessible names, focus, keyboard, aria-live), or guarding it all
  with Playwright role/label locators and make test-visual.
---

# Frontend Performance & Accessibility

This skill covers performance and accessibility work on the VilnaCRM marketing
website (Next.js 16 pages router, React 19, MUI 9 + Emotion, react-hook-form,
i18next). Every command below is a real Makefile target; run it from the repo
root. Telemetry wiring (Sentry, Next.js web-vitals reporting) belongs to the
`observability-instrumentation` skill — this skill is about measuring,
diagnosing, and verifying, not instrumenting.

## Performance Checks

Lighthouse CI (`@lhci/cli`) is the page-level performance and best-practice
gate. Both targets build and serve the production app, then audit the home
route (`/`) and `/swagger`:

```bash
make lighthouse-desktop
make lighthouse-mobile
```

Reach for these when a change touches layout, above-the-fold imagery, asset
weight, data fetching, routing, or render cost. The pass/fail score budgets are
declared in `lighthouserc.desktop.js` and `lighthouserc.mobile.js` (performance,
accessibility, best-practices, and SEO category minimums) — read those files
before assuming a target; never lower a budget to make a run pass. See
[reference/lighthouse.md](reference/lighthouse.md) for the review areas.

## Core Web Vitals

Treat LCP, CLS, and INP as the diagnostic vocabulary behind a Lighthouse
performance regression:

- LCP — how fast the main content paints (hero image, headline).
- CLS — visual stability; punishes late layout shifts.
- INP — responsiveness of the heaviest interaction.

For runtime field signals, route the wiring through the
`observability-instrumentation` skill (Sentry + Next.js `reportWebVitals`); do
not add ad-hoc reporters here. Locally, pair code review with Lighthouse and
`make test-visual`. Details and the website-specific causes/fixes are in
[reference/web-vitals.md](reference/web-vitals.md).

## Accessibility Checks

The website already leans on semantic MUI components and native controls — keep
it that way:

- Give buttons, links, fields, dialogs, and icon-only controls accessible
  names. Icon-only controls use `aria-label` (often `t(...)`); purely
  decorative images use `alt=""` with `aria-hidden="true"`.
- Keep react-hook-form errors associated with their field so the message is
  announced, and expose async status via `aria-live` (the registration loader
  uses `aria-live="polite"`).
- Localize accessible names through i18next `t()` so `en`/`uk` stay covered.
- Lock regressions with Playwright role and label locators (`getByRole`,
  `getByLabel`, `getByAltText`) in `src/test/e2e`, mirroring the existing specs.
- Exercise keyboard interaction for the drawer/menu, dialogs, forms, and route
  changes.

The full checklist is in [reference/a11y-review.md](reference/a11y-review.md).

## The Accessibility Gate (issues #317, #369)

Accessibility is no longer advisory. The binding target is **WCAG 2.1 AA**,
asserted per rule at three layers — two under `make test-a11y` and the
`accessibility testing` workflow, one inside the e2e suite:

```bash
make test-a11y              # the component and route gates
make test-a11y-components   # jest-axe over rendered React (jsdom, fast)
make test-a11y-routes       # axe + a keyboard sweep in all three browsers
make test-e2e               # carries the interaction-state scans
```

- The component layer covers **semantics only** — roles, names, states,
  relationships. jsdom has no layout engine, so contrast, focus appearance and
  reflow are unreachable there and belong to the route layer. A green component
  test is necessary, never sufficient.
- Adding a page means adding it to `src/test/a11y/routes.ts`; a unit test fails
  when that registry drifts from `pages/`.
- The interaction-state layer scans axe mid-journey — validation errors, the
  submit-error notification, the open mobile drawer, an expanded Swagger
  operation, the authorize dialog — because neither static lint nor an
  initial-load scan can see composed, conditional DOM. Register a new state in
  `src/test/a11y/interaction-states.ts` and call
  `scanInteractionState(page, INTERACTION_STATES.<state>)` from the journey that
  already drives it; a unit test reads the specs and fails when a registered
  state stops being scanned. These scans gate serious/critical impacts only, and
  reuse the route's exception context.
- The axe tag list and the exception allowlist live only in
  `src/test/a11y/axe-config.ts`.

Never make the gate pass by suppressing it — no `eslint-disable`, no axe rule
removal, no `test.skip`, and never an `if (count > 0)` / `if (isVisible())`
wrapper around an assertion. Accepted debt goes through the documented
exception allowlist with a rule id, a scope, a reason, and a tracking issue.

Read [docs/accessibility/acceptance-standard.md](../../../docs/accessibility/acceptance-standard.md)
for the conformance target, what automation cannot see, and the exception
process.

## Rendering Rules

- Avoid layout shift from dynamic labels, counters, notifications, and loading
  states; give late-loading media explicit `width`/`height` (CLS).
- Keep heavy computation out of the render path.
- Memoize only when a measurement or the code shape shows repeated cost — not by
  reflex.
- Preserve readable contrast and visible focus states across both color themes.

## Image and Font Sustainability Policy (issue #341)

Page weight is a durability concern, not only a score: nothing goes red when the
export slowly gets heavier. Three committed artifacts hold the line, and each one
answers a different question.

### Images — WebP conversion at export time

`export-images.config.js` configures `next-export-optimize-images`, which the
static export (`output: 'export'`) runs over every raster asset imported through
`next-export-optimize-images/image`:

```js
convertFormat: [
  ['png', 'webp'],
  ['jpg', 'webp'],
  ['jpeg', 'webp'],
];
```

- Every PNG/JPG/JPEG source gets a WebP sibling, and the exported `<picture>`
  serves WebP with the original as the fallback. Markup does not change.
- WebP is decoded by every browser the Playwright matrix covers (Chromium,
  Firefox, WebKit), so the fallback is a safety net rather than a served path.
- AVIF is deliberately **not** in the list: it encodes far more slowly on every
  build for a marginal gain over WebP on assets this size. Adding it is a
  measured decision, not a default.
- SVGs are untouched — vector, already optimal.
- Source assets are compressed in-place on PRs by
  `.github/workflows/image-optimization.yml` (`calibreapp/image-actions`), which
  ignores `src/test/**` so fixtures and visual baselines are never rewritten.

Import raster assets through the optimizer; a raw `<img src>` to a file in
`public/` bypasses the whole pipeline and ships the unconverted original.

### Fonts — self-hosted woff2, no external request

There is no `<link rel="preload">` list in `pages/_document.tsx`. Both families
are declared with `next/font/local`, which self-hosts the files, emits the
`@font-face` rules, and injects the preload links for the faces a page actually
uses:

- `src/config/Fonts/golos.ts` — six Golos Text woff2 faces (400/500/600/700/800/
  900), roughly 25 KB each.
- `src/config/Fonts/inter.ts` — three Inter woff2 faces (400/500/700), roughly
  100 KB each.

Both set `display: 'swap'`, so text paints in the fallback face immediately and
never blocks LCP. woff2 is the only shipped format — every target browser
supports it, so a woff/ttf fallback would be dead weight.

The policy when touching fonts:

- Never add a face that no theme references. Inter is the heavier family per
  face, so a fourth Inter weight costs roughly four Golos weights.
- Never load a family from a third-party host: it adds a connection on the
  critical path and leaks visitor IPs.
- Latin plus Cyrillic is required (the site ships `en` and `uk`), which is what
  the current file sizes reflect. If subsetting is introduced, it must keep the
  full Cyrillic range — a Latin-only subset silently breaks the `uk` locale.

### Transfer-size budgets — where the numbers come from

The byte budgets are Lighthouse assertions, built in `lighthouserc.shared.js` and
supplied per form factor by `lighthouserc.desktop.js` and `lighthouserc.mobile.js`:

```js
'resource-summary:script:size': ['error', { maxNumericValue: scriptBytes, ...median }],
'resource-summary:stylesheet:size': ['error', { maxNumericValue: stylesheetBytes, ...median }],
'resource-summary:font:size': ['error', { maxNumericValue: fontBytes, ...median }],
'resource-summary:image:size': ['error', { maxNumericValue: imageBytes, ...median }],
'resource-summary:total:size': ['error', { maxNumericValue: totalBytes, ...median }],
```

The byte budgets that do not depend on the form factor (script, stylesheet, font and
total, plus the swagger image budget) are declared once, as `BYTE_BUDGETS` in
`lighthouserc.shared.js`; `assertMatrix` merges each config's page budgets over them, so a
config carries only its scores, timings and the homepage image budget, the one byte budget
that differs between desktop and mobile. `pageBudgets` takes every byte budget as a
**required** parameter with no default,
so a config that forgets one fails `src/test/unit/lighthouse/lighthouse-config.test.ts`
instead of silently dropping the assertion. The keys are Lighthouse's own
`resource-summary` type ids (`script`, `stylesheet`, `font`, `image`, `total`); the
spec pins that key set on every page.

- Every number is derived from **measured CI samples**, recorded in the configs,
  with headroom for shared-runner variance — they are not round numbers picked by
  taste. Across CI runs 35945072114, 36034847382 and 36038654988 (three samples per
  page and form factor each):

  | Page, form factor | Script (B)      | Stylesheet (B) | Font (B) | Image (B)       | Total (B)           |
  | ----------------- | --------------- | -------------- | -------- | --------------- | ------------------- |
  | Home, desktop     | 516,563–517,866 | 39,288         | 474,662  | 292,134         | 1,336,470–1,337,763 |
  | Home, mobile      | 516,563–517,866 | 39,288         | 474,662  | 197,733–197,846 | 1,242,069–1,243,507 |
  | Swagger, desktop  | 910,234         | 37,171         | 474,662  | 10,730–10,843   | 1,452,869–1,452,982 |
  | Swagger, mobile   | 910,234         | 37,171         | 474,662  | 11,455          | 1,453,591           |

  The swagger rows come from CI run 36118768171, the first run that audited the loaded
  documentation (issue #498).

  The budgets are 750 KB script / 1.55 MB total on the homepage and 1.05 MB /
  1.48 MB on swagger; 45,000 B stylesheet and 500,000 B font everywhere; 320,000 B
  image on the desktop homepage, 220,000 B on the mobile homepage and 15,000 B on
  swagger. Swagger is heavier on script because it ships the swagger-ui bundle.

- Until issue #498 the host build that CI audits never ran
  `scripts/patchSwaggerServer.mjs`, so `/swagger-schema.json` returned 404 and every
  swagger budget was calibrated on the failed-to-load page. The swagger budgets were
  re-calibrated from the loaded page: the total grew by the 3,953 B schema, mobile
  swagger TBT (2.3 s) and LCP (11.6 s) moved to 3 s and 14 s ceilings, and the desktop
  swagger accessibility floor rose from 0.89 to 0.9 (measured 0.95).
- The font and stylesheet margins are tight **on purpose**. Those bytes are static
  per build — every sample above loaded the same nine faces and the same CSS — so
  there is no run-to-run noise to absorb. The 25,338 B font margin is smaller than
  the smallest shipped face (Golos Text Regular, 25,508 B transferred), so adding any
  face fails the gate; the spec asserts that bound. The homepage image budgets sit
  about 10% over the largest sample, because an extra small image request sometimes
  lands inside the sampled window; the swagger image budget is about twice its
  largest sample until the loaded-state re-measure.
- Script, stylesheet, font and total budgets are shared by both form factors; the
  homepage image budget is not. The desktop viewport fetches the 99,529 B desktop
  hero at two widths (3840w and 2048w), the mobile viewport once, so the two
  baselines differ by about 94 KB. Responsive image selection and
  viewport-conditional resources are exactly why a byte budget is a measurement,
  not an invariant: re-measure **both** form factors before changing either one.
- Every gated assertion uses `aggregationMethod: 'median-run'` (set once as
  `median` in `lighthouserc.shared.js` and spread into every assertion built by
  `pageBudgets`). It does **not** take a median per assertion: LHCI picks a single
  representative run from the collected set using key performance metrics, and that
  one run then supplies the value for every assertion. So the gate is judged on a
  self-consistent report rather than on a per-metric mix of runs, and a single cold
  or slow outlier is discarded wholesale. What it does not buy is determinism or
  per-metric smoothing — the representative run is chosen on performance metrics,
  so an assertion that is noisy independently of them is not damped at all, and if
  most runs breach a budget the selected run breaches it too.
- The **ratchet rule** applies: budgets may only move in the stricter direction
  (lower `maxNumericValue`, higher `minScore`). Re-baseline with
  `make lighthouse-desktop` / `make lighthouse-mobile` before changing a number,
  and never raise a budget to make a run green — if the export got heavier, find
  out what was added.

The reasoning behind the delivery model these budgets exist inside is recorded in
[ADR 0001](../../../docs/adr/0001-static-export-s3-cloudfront.md); the ADR log
index is [docs/adr/README.md](../../../docs/adr/README.md).

## Verification

Run the subset that matches the change, then close out with the lint gate:

```bash
make test-unit-client
make test-e2e
make test-visual
make lighthouse-desktop
make lighthouse-mobile
make format
make lint
```

`make format` (Prettier) runs before `make lint` (ESLint + TypeScript +
markdownlint + dependency-cruiser). Any unit suite runs locally without Docker
when prefixed with `EXEC_MODE=host` (for example
`EXEC_MODE=host make test-unit-client`). If a deliberate, reviewed UI change
makes screenshots stale, regenerate them with `make test-visual-update` and
review the diff before committing.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md), and hand telemetry
work to the `observability-instrumentation` skill. The root
[`AGENTS.md`](../../../AGENTS.md) test-coverage policy still governs any tests
you add (positive, negative, and edge classes; behavior-first assertions).

## Supporting Files

- [reference/lighthouse.md](reference/lighthouse.md): Lighthouse targets,
  audited routes, and review areas.
- [reference/web-vitals.md](reference/web-vitals.md): LCP, CLS, and INP notes
  with website-specific causes and fixes.
- [reference/a11y-review.md](reference/a11y-review.md): accessibility review
  checklist and Playwright locator pattern.
