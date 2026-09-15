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

There is no backend service in this repo to instrument. `@sentry/node` ships as
a dependency for the Apollo Server 5 local mock / Next.js server runtime, but it
is not currently wired. Do not scatter server SDK calls into client code; the
active telemetry surface is `@sentry/react`.

## Current wiring (verified)

Checked against `pages/_app.tsx`, `src/config/env.ts`, `next.config.js`,
`src/lib/web-vitals/report-web-vitals.ts` and `src/lib/telemetry/report-error.ts`
(issue #336). Anything not listed here is not wired.

- **`Sentry.init` in `pages/_app.tsx`** — the single init, from `@sentry/react`:
  - `dsn: env.NEXT_PUBLIC_SENTRY_DSN`, read through the zod schema in
    `src/config/env.ts` (`z.string().trim().default('')`). `.env`, `.env.example`
    and `.env.production` all declare it **empty**, so the SDK initialises with no
    DSN and sends nothing until a maintainer commits the real (public) DSN in
    `.env.production`. `src/test/unit/client-env-contract.test.ts` pins the key's
    presence in both env files.
  - `sendDefaultPii: false`, pinned explicitly (#378 F3).
  - `browserTracingIntegration()` and
    `replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true })`
    — the masking is pinned so an upstream default change cannot start recording
    the sign-up form's password field.
  - `tracePropagationTargets` limited to `NEXT_PUBLIC_DEVELOPMENT_API_URL` and
    `NEXT_PUBLIC_API_URL`, with empty values filtered out.
  - `tracesSampleRate: 1.0`, `replaysSessionSampleRate: 0.1`,
    `replaysOnErrorSampleRate: 1.0`. No `enabled`, `release` or `environment` key,
    and no `beforeSend` scrubber, yet.
- **Handled errors** — `reportHandledError` in `src/lib/telemetry/report-error.ts`
  wraps `Sentry.captureException` with static `feature`/`action` tags only; the
  sign-up mutation path in `auth-layout.tsx` is its one caller (#378 F3).
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
- **Not wired** — no `Sentry.ErrorBoundary` or other error boundary; no Apollo
  `ErrorLink` (`src/features/landing/api/graphql/apollo.ts` builds the client with
  an `HttpLink` only); and `@sentry/node` is imported by nothing.

Add the missing pieces through `@sentry/react` and Next.js built-ins (below), never
a new dependency. Production monitoring — the scheduled uptime check, the alert
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

The full list and a `beforeSend` scrubber live in
[reference/privacy-checklist.md](reference/privacy-checklist.md).

## Sampling policy

- Keep **error** capture effectively unsampled — you want every exception.
- **Sample** high-volume signals (traces, session replay, web-vitals) to control
  quota. The live rates are in `pages/_app.tsx`; tune them there and never add
  per-call overrides. Treat that file as the single source of truth.
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
