# Lighthouse

## Commands

```bash
make lighthouse-desktop
make lighthouse-mobile
```

In the default container mode both targets depend on `start-prod`: they build
and serve the production app, then run Lighthouse CI (`@lhci/cli`) against it.
With `EXEC_MODE=host` — the path CI takes — the recipe runs
`scripts/patchSwaggerServer.mjs` first (with the server URL the Docker build
bakes), builds the static export, and lets LHCI serve `out/` itself. It refuses
to start LHCI when `out/swagger-schema.json` is missing or empty: the schema is
gitignored, so without the patch step `/swagger` would be audited in its
failed-to-load state (issue #498). Use them whenever layout, loading, asset
weight, routing, or render cost changes — not on logic-only diffs.

## Audited routes

The collectors in `lighthouserc.desktop.js` and `lighthouserc.mobile.js` audit
two URLs: the home route (`/`) and `/swagger`. A change that only affects one
surface still reports both, so read the right report.

## Score budgets

Both config files gate through `assertMatrix` (LHCI rejects `assertMatrix`
alongside a shared `assertions` block), with a per-page entry for the homepage
and a looser one for the heavier `/swagger` URL. Each entry asserts category
floors (`categories:performance`, `categories:accessibility`,
`categories:best-practices`, `categories:seo`) plus metric ceilings
(`largest-contentful-paint`, `total-blocking-time`, `cumulative-layout-shift`)
and `resource-summary` script/total byte budgets. Desktop and mobile carry
different floors; always open the config to read the current numbers instead of
memorizing them.

Floors, metric ceilings, and byte budgets are ratcheted from a CI baseline and
may only move in the stricter direction. If an audit fails, fix the underlying
issue (image weight, contrast, missing labels, render-blocking work). Never lower
a `minScore`, raise a `maxNumericValue`, add an exclusion, or otherwise weaken the
gate to turn a run green.

## Review areas

- Performance score and Core Web Vitals (see web-vitals.md).
- Accessibility findings — overlaps the a11y-review checklist.
- Best-practice failures (console errors, deprecated APIs, insecure requests).
- SEO category (the budgets gate it too).
- Mobile-specific layout, font-size, and tap-target issues on the mobile run.

## CI parity

The pull-request gate is `performance-testing.yml`, which runs
`make lighthouse-desktop` and `make lighthouse-mobile` with `EXEC_MODE=host` as
a matrix and uploads the raw reports as the `lighthouse-reports-<form factor>`
artifacts. `make ci-test-lighthouse-desktop` / `make ci-test-lighthouse-mobile`
are the DIND variants behind the local `make ci-test-prod` sequence.
