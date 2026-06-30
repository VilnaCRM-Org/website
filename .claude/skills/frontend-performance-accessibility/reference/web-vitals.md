# Core Web Vitals

## Signals

- **LCP** — loading speed of the main content (hero image, headline). On the
  landing page this is usually an above-the-fold `next-export-optimize-images`
  image or the first heading.
- **CLS** — visual stability; late layout shifts from images without reserved
  space, web fonts, or injected notifications/loaders.
- **INP** — interaction responsiveness; the cost of the heaviest interaction
  (form submit, drawer toggle, theme switch).

## Website-specific causes and fixes

- LCP: serve above-the-fold imagery through the project's `Image` wrapper with
  correct dimensions and priority, and keep render-blocking work (heavy
  synchronous compute, large eager imports) off the critical path. `next/dynamic`
  already defers non-critical chunks — extend that pattern rather than eagerly
  importing.
- CLS: always pass explicit `width`/`height` (or reserved box dimensions) so
  late-loading media cannot reflow content. Reserve space for the registration
  form's success/error notification and loader instead of letting them push
  layout.

```tsx
function HeaderLogo() {
  return <Image src={logo} alt={t('header.logo_alt')} width={131} height={44} />;
}
```

- INP: keep event handlers light; move expensive work out of the click/submit
  path. Memoize only when a measurement shows repeated cost.

## Measuring vs. instrumenting

Lighthouse (`make lighthouse-desktop` / `make lighthouse-mobile`) reports lab
LCP/CLS/INP per run — that is the local diagnostic. For runtime _field_ signals
(real user data), wire reporting through the `observability-instrumentation`
skill, which owns Sentry and the Next.js pages-router `reportWebVitals` hook. Do
not add ad-hoc web-vitals reporters from this skill; add the signal only when the
product needs it. For local validation, pair code review with Lighthouse and
`make test-visual`.
