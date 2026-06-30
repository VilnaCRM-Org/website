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

## Rendering Rules

- Avoid layout shift from dynamic labels, counters, notifications, and loading
  states; give late-loading media explicit `width`/`height` (CLS).
- Keep heavy computation out of the render path.
- Memoize only when a measurement or the code shape shows repeated cost — not by
  reflex.
- Preserve readable contrast and visible focus states across both color themes.

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
when prefixed with `CI=1` (for example `CI=1 make test-unit-client`). If a
deliberate, reviewed UI change makes screenshots stale, regenerate them with
`make test-visual-update` and review the diff before committing.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md), and hand telemetry
work to the `observability-instrumentation` skill. The root
[`agents.md`](../../../agents.md) test-coverage policy still governs any tests
you add (positive, negative, and edge classes; behavior-first assertions).

## Supporting Files

- [reference/lighthouse.md](reference/lighthouse.md): Lighthouse targets,
  audited routes, and review areas.
- [reference/web-vitals.md](reference/web-vitals.md): LCP, CLS, and INP notes
  with website-specific causes and fixes.
- [reference/a11y-review.md](reference/a11y-review.md): accessibility review
  checklist and Playwright locator pattern.
