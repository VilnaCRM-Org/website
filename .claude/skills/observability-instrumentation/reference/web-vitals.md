# Core Web Vitals

This site has no `web-vitals` npm package — Next.js reports field vitals through
the pages-router `reportWebVitals` export. Add it to `pages/_app.tsx`; do not
install a separate reporter.

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

Export `reportWebVitals` from `pages/_app.tsx`. Type the metric with
`NextWebVitalsMetric`, gate forwarding behind production, and sample to control
volume:

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

## Measuring vs. instrumenting

`reportWebVitals` gives real-user _field_ data. Lab diagnosis — Lighthouse
budgets and the per-vital causes/fixes — lives in the
`frontend-performance-accessibility` skill
([../../frontend-performance-accessibility/reference/web-vitals.md](../../frontend-performance-accessibility/reference/web-vitals.md)).
Add the runtime signal only when the product needs it, and route the analysis
there.
