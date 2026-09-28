# Core Web Vitals

This site has no `web-vitals` npm package — Next.js reports field vitals through
the pages-router `reportWebVitals` export. It is wired: `pages/_app.tsx` exports
`reportWebVitals`, delegating to `src/lib/web-vitals/report-web-vitals.ts` (the
forwarding gate + PII-free payload). Do not install a separate reporter.

## Signals

- **LCP** — loading speed of the main content (landing hero image or first
  heading).
- **CLS** — visual stability; late shifts from unsized media, web fonts, or
  injected loaders/notifications.
- **INP** — responsiveness of the heaviest interaction (form submit, drawer
  toggle, theme switch).

Next.js also emits custom metrics (hydration, route-change, render) on the same
callback; forward or ignore them by inspecting `metric.label`.

## Wiring

`pages/_app.tsx` exports `reportWebVitals` and delegates to
`src/lib/web-vitals/report-web-vitals.ts`, which types the metric with
`NextWebVitalsMetric`, gates forwarding behind production, samples to control
volume, and ships to GA4 (`window.gtag`) plus Sentry (`setMeasurement`). The shape:

```ts
import type { NextWebVitalsMetric } from 'next/app';

const VITALS_SAMPLE_RATE = 0.1;

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (metric.label !== 'web-vital') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (Math.random() > VITALS_SAMPLE_RATE) return;

  // Forward { name, value, id } to Sentry or analytics — never any PII.
}
```

Send only the metric `name`, `value`, and `id`; that payload is inherently
PII-free, so keep it that way.

The shipped module's constants and the reasons behind them (this is the rationale
record; the source itself carries no comments, ADR 0005):

- **`label: 'web-vital'` only.** Next.js reports the field vitals with that label and
  also emits framework timings (hydration, route-change, render) with `label: 'custom'`;
  those are dropped so only true field vitals reach analytics.
- **10% sample.** Field data is statistical, so the sample keeps analytics volume (and
  cost) bounded while still yielding a representative distribution. The gate takes
  `isProduction` and the sample as arguments so it stays deterministic and unit-testable.
- **`gtag` is read off `window`.** The `<GoogleAnalytics />` tag in `_app` injects it;
  reading the global (rather than importing the dev-only `@next/third-parties` helper
  into runtime code) keeps `src` free of devDependency imports and lets the forward
  no-op gracefully before the GA script has loaded.
- **CLS is scaled by 1000, durations rounded to ms.** GA4 event values must be integers.
  CLS is a unitless layout-shift ratio (every other forwarded vital is a millisecond
  duration), so it uses the conventional web-vitals→GA transform.
- Sentry only records once the DSN is set (#322) and GA only once a real measurement id
  replaces the placeholder; the hook is wired now so telemetry is live the moment those
  keys are fixed.

## Measuring vs. instrumenting

`reportWebVitals` gives real-user _field_ data. Lab diagnosis — Lighthouse
budgets and the per-vital causes/fixes — lives in the
`frontend-performance-accessibility` skill
([../../frontend-performance-accessibility/reference/web-vitals.md](../../frontend-performance-accessibility/reference/web-vitals.md)).
Add the runtime signal only when the product needs it, and route the analysis
there.
