---
name: observability-instrumentation
description: >-
  Use when wiring website frontend telemetry — Sentry browser init in
  pages/_app.tsx (@sentry/react), error boundaries, captureException with
  feature/route tags, the no-PII payload contract, sampling rates
  (tracesSampleRate / session replay), Next.js pages-router reportWebVitals
  (LCP/CLS/INP), and Apollo Client 4 error reporting. Triggers on "Sentry",
  "error boundary", "captureException", "reportWebVitals", "web-vitals",
  "telemetry", "tracesSampleRate", "session replay", "scrub PII".
---

# Observability Instrumentation

## Scope

VilnaCRM's marketing website (Next.js 16 pages router, React 19, MUI 9 +
Emotion, Apollo Client 4, react-hook-form, i18next) is a client-rendered
frontend. Instrument client-side failures and real-user signals; this skill
owns the _wiring_. Measuring and diagnosing — Lighthouse budgets, Core Web
Vitals analysis — belong to the `frontend-performance-accessibility` skill;
route audit results there.

There is no backend service in this repo to instrument, and the only Sentry SDK
the website uses is `@sentry/react`. Do not add a server SDK or scatter server SDK
calls into client code.

## Current wiring (verified)

Checked against `pages/_app.tsx`, `src/config/env.ts`, `src/config/app-version.ts`,
`next.config.js`, `src/features/landing/api/graphql/apollo.ts`,
`src/lib/web-vitals/report-web-vitals.ts` and `src/lib/telemetry/` (issue #336,
ADR 0009). Anything not listed here is not wired.

- **`Sentry.init` in `pages/_app.tsx`** — the single init, from `@sentry/react`:
  - `dsn: env.NEXT_PUBLIC_SENTRY_DSN`, read through the zod schema in
    `src/config/env.ts` (`z.string().trim().default('')`). `.env`, `.env.example`
    and `.env.production` all declare it **empty**, so the SDK initialises with no
    DSN and sends nothing until a maintainer commits the real (public) DSN in
    `.env.production`. `src/test/unit/client-env-contract.test.ts` pins the key's
    presence in both env files.
  - `enabled: Boolean(env.NEXT_PUBLIC_SENTRY_DSN)` — the SDK is switched off
    explicitly whenever the DSN is empty. The app-level error boundary still
    renders its fallback when the SDK is disabled.
  - `sendDefaultPii: false`, pinned explicitly (#378 F3).
  - `browserTracingIntegration()` and
    `replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true })`
    — the masking is pinned so an upstream default change cannot start recording
    the sign-up form's password field.
  - `tracePropagationTargets` limited to `NEXT_PUBLIC_DEVELOPMENT_API_URL` and
    `NEXT_PUBLIC_API_URL`, with empty values filtered out.
  - `tracesSampleRate` comes from `resolveTracesSampleRate` in
    `src/lib/telemetry/traces-sample-rate.ts`, fed
    `env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` and `APP_ENVIRONMENT`. The variable
    is a number from 0 to 1, validated in `src/config/env.ts`; empty (as every
    committed env file ships it) selects the default — `0.1` in a production build,
    `1.0` in development. `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`.
  - `release: APP_VERSION` (the `package.json` version) and
    `environment: APP_ENVIRONMENT` (`production` or `development`, from
    `isProductionBuild()`), both from `src/config/app-version.ts`.
  - `beforeSend: scrubEvent` (`src/lib/telemetry/scrub-event.ts`) and
    `beforeBreadcrumb: scrubBreadcrumb` (`src/lib/telemetry/scrub-breadcrumb.ts`)
    — the no-PII backstop described under
    [reference/privacy-checklist.md](reference/privacy-checklist.md).
  - `src/test/unit/sentry-replay-masking.test.ts` and
    `src/test/unit/sentry-app-observability.test.ts` parse this call with the
    TypeScript compiler and fail if `sendDefaultPii`, the mask options, the
    `enabled` guard, the sample-rate wiring, `release`/`environment`, either
    scrubber or the boundary wiring below drift.
- **Render crashes** — `Sentry.ErrorBoundary` wraps only `<Component />` inside
  `Layout`, so the header, skip link and footer survive a page crash. Its fallback
  is `src/components/error-fallback` (localized, `role="alert"`, retry + home
  link). The boundary captures the crash itself; a `beforeCapture` callback
  (`tagRenderCrash`) tags that single event `{ feature: 'app', action:
'render-crash' }`. There is deliberately no `onError` sink — it would report every
  crash twice (ADR 0009). Its `onReset` (`focusPageStart`) moves focus to
  `#skip-target`, the `tabIndex={-1}` anchor `Layout` renders right before the page,
  because a successful retry unmounts the focused retry button and would otherwise
  drop keyboard focus to `<body>` (WCAG 2.4.3). The boundary does not depend on the
  SDK being enabled: with no DSN it still renders the fallback.
  `src/test/testing-library/AppErrorBoundary.test.tsx` renders the real `MyApp` with a
  crashing page and proves the fallback, the keyboard retry and the focus return.
- **Handled errors** — `reportHandledError` in `src/lib/telemetry/report-error.ts`
  wraps `Sentry.captureException` with static `feature`/`action` tags only. Its two
  callers are the sign-up submit path (#378 F3) and the Apollo `ErrorLink`.
- **Route tag** — `scrubEvent` finishes by calling `withRouteTag`
  (`src/lib/telemetry/route-tag.ts`), which adds a `route` tag to every error event:
  the pathname of the already-scrubbed `request.url` (the page the visitor was on),
  never its query string or fragment, with email-shaped segments redacted and capped
  at Sentry's 200-character tag-value limit. An event with no absolute page URL gets
  no `route` tag. Deriving it in `beforeSend` rather than in `reportHandledError`
  tags render crashes as well, and keeps the capture call's own tags static. The
  `request.url` it reads is filled in by the SDK's default HttpContext integration,
  so `Sentry.init` must never set `defaultIntegrations` (and `integrations` stays an
  array literal, which adds to the defaults instead of replacing them):
  `sentry-app-observability.test.ts` rejects the option, and `route-tag.test.ts`
  fails if an SDK upgrade stops registering HttpContext by default.
- **Apollo errors** — `src/features/landing/api/graphql/apollo.ts` puts a
  reporting-only `ErrorLink` first in the link chain; it calls
  `reportHandledError(error, { feature: 'landing', action: 'graphql' })`, never
  returns a value, so it never retries and never changes what
  `handleApolloError` shows the visitor. There is no `RetryLink`.
- **Core Web Vitals** — `reportWebVitals` is exported from `pages/_app.tsx` and
  delegates to `handleWebVitalsMetric` in `src/lib/web-vitals/report-web-vitals.ts`
  (#332): field vitals only (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`), production builds
  only (`isProductionBuild()`), a 10% sample, and a `name`/`id`/`value` payload
  forwarded to `gtag` and `Sentry.setMeasurement`. No `web-vitals` npm package.
- **Google Analytics** — `<GoogleAnalytics>` from `@next/third-parties` renders only
  when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is non-empty; it is empty in every committed
  env file.
- **Console** — `compiler.removeConsole` in `next.config.js` strips
  `console.log`/`debug` from production bundles but keeps `console.error` and
  `console.warn` (#378 F3), so the browser console stays a diagnostic channel.
- **Not wired** — no source-map upload, and no scrubber on transaction events
  (`beforeSendTransaction`): they carry span names and URLs, not form values.

Extend this surface through `@sentry/react` and Next.js built-ins, never a new
dependency. Production monitoring — the scheduled uptime check, the alert
labels, and what is inert — is documented in `docs/runbooks/monitoring.md`.

## Signals to instrument

- **Sentry errors, traces, and session replay** through `@sentry/react` (the
  single `Sentry.init` in `pages/_app.tsx`).
- **Core Web Vitals** through the Next.js pages-router `reportWebVitals` export
  (LCP, CLS, INP) — no extra package. See
  [reference/web-vitals.md](reference/web-vitals.md).
- **Apollo Client 4 errors** captured at the feature `api/` boundary, not in
  presentational components. See
  [reference/sentry-patterns.md](reference/sentry-patterns.md).
- **React render failures** caught by a `Sentry.ErrorBoundary` at the app/route
  boundary. See
  [examples/frontend-error-boundary.md](examples/frontend-error-boundary.md).

## No-PII payload contract

Telemetry must never carry user-identifying or secret data; capture only
feature-level context.

- Allowed: route/pathname, feature name, a coarse error category, non-sensitive
  HTTP status codes, and i18next _keys_ (never the rendered, possibly localized
  string).
- Forbidden: passwords, tokens, cookies, auth headers; raw react-hook-form field
  values (email, name, password); full request/response bodies; and any free
  text the user typed.

The full list, and what the wired `beforeSend` / `beforeBreadcrumb` scrubbers
remove, live in [reference/privacy-checklist.md](reference/privacy-checklist.md).

## Sampling policy

- Keep **error** capture effectively unsampled — you want every exception.
- **Sample** high-volume signals (traces, session replay, web-vitals) to control
  quota. The live rates are in `pages/_app.tsx`; the trace rate is tuned through
  `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0.1` in production), the replay
  rates in that file. Never add per-call overrides.
- Gate web-vitals forwarding behind a production check and a sample rate so dev
  noise and quota stay bounded.

## Tags and context

Attach low-cardinality tags so issues group well: `feature` (e.g.
`registration`), `route`/pathname, and `surface` (e.g. `app`, `auth-form`). Put
variable detail in `extra`, never in tags. Patterns are in
[reference/sentry-patterns.md](reference/sentry-patterns.md).

## Rules

- Capture domain context without secrets or PII (see the contract above).
- Keep instrumentation out of presentational components — wrap it in typed
  helpers, the feature `api/` layer, or a boundary.
- Reuse the single `Sentry.init`; do not create scattered direct SDK calls.
- Telemetry must be resilient: a reporting failure must never break a user flow.
- Add or update tests when wiring or error-handling branches change, per
  `AGENTS.md` (positive, negative, and edge classes; behavior-first assertions).

## Verification

```bash
make format
make test-unit-client
make lint
```

Wiring that only runs in the browser (Sentry transport, session replay,
web-vitals emission) cannot be proven by unit tests alone — verify it in a real
browser, and pair vitals work with `make lighthouse-desktop` /
`make lighthouse-mobile`.

## Related guides

Confirm the task against [../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md). Hand measurement and
Core Web Vitals diagnosis to
[../frontend-performance-accessibility/SKILL.md](../frontend-performance-accessibility/SKILL.md).
The root [`AGENTS.md`](../../../AGENTS.md) test-coverage policy governs any tests
you add.

## Supporting files

- [reference/sentry-patterns.md](reference/sentry-patterns.md): capture
  boundaries, tags, sampling, and safe context.
- [reference/web-vitals.md](reference/web-vitals.md): Next.js `reportWebVitals`
  wiring for LCP, CLS, and INP.
- [reference/privacy-checklist.md](reference/privacy-checklist.md): the no-PII
  payload contract and scrubbing.
- [examples/frontend-error-boundary.md](examples/frontend-error-boundary.md): a
  `Sentry.ErrorBoundary` at the app boundary.
