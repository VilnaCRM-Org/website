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

`pages/_app.tsx` already calls `Sentry.init()` from `@sentry/react` with
`dsn: process.env.SENTRY_DSN_KEY`, `browserTracingIntegration()` and
`replayIntegration()`, and these sampling rates:

- `tracesSampleRate: 1.0`
- `replaysSessionSampleRate: 0.1`
- `replaysOnErrorSampleRate: 1.0`

Google Analytics is wired separately via `@next/third-parties`. There is no
`web-vitals` npm package and no error boundary yet — add those through Next.js
built-ins and `@sentry/react` (below), never a new dependency.

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
CI=1 make test-unit-client
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
