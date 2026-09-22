# ADR 0009: One error boundary, ErrorLink-only Apollo reporting, and release/environment tags

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** website maintainers
- **Related:** issue #336, issue #329, issue #322, issue #325 (Sentry half), ADR 0005,
  `src/lib/telemetry/report-error.ts`, `pages/_app.tsx`,
  `src/features/landing/api/graphql/apollo.ts`

## Context

Three open issues each proposed their own version of the same capability: a React error
boundary for an uncaught render crash (#336, #322), Sentry release/environment tagging
(#325), and an Apollo error-reporting link (#329, #322). Left unreconciled they would have
shipped three incompatible fallback UIs, three tag shapes, and — worst — two independent
error-reporting paths racing each other on the same crash. The repository owner chose one
design in place of all three; this record is that design.

The constraints that were real when it was made:

- `src/lib/telemetry/report-error.ts` already exists as the single handled-error sink
  (`reportHandledError`, added for #378 F3), used by the sign-up form's submit handler. A
  second, differently-shaped sink would fork the tag contract `AuthLayoutTelemetry.test.tsx`
  already pins.
- `src/test/unit/sentry-replay-masking.test.ts` parses `pages/_app.tsx` with the TypeScript
  compiler and fails unless `sendDefaultPii: false` and the replay integration's three mask
  options survive verbatim (#337, #378 F3). Any change to `Sentry.init` has to add sibling
  properties without disturbing that literal shape.
- Apollo Client 4 moved the error-link entry point to `@apollo/client/link/error`
  (`ErrorLink`), replacing the v3 `onError` factory the three source issues each assumed;
  none of their drafts had been checked against the installed version.
- The sign-up form already owns its own retry affordance (the notification's retry
  button, `src/features/landing/components/notification/notification-error.tsx`). A
  transparent Apollo retry link would resubmit the mutation the visitor already retried
  manually, risking a duplicate account.
- `docs/runbooks/monitoring.md` stated, verbatim, "There is no error boundary: an
  uncaught render error is neither reported nor shown to the user" — a sentence a
  consolidated design makes false and that has to be rewritten in the same change.

## Decision

We ship one error boundary, one Apollo error-reporting link, and two new `Sentry.init`
tags, all funnelling through the existing `reportHandledError` sink.

- **`Sentry.ErrorBoundary` wraps only `<Component />`** in `pages/_app.tsx` — not
  `Layout`, not the header, not the footer. A crash inside page content leaves the header,
  the skip link and the footer usable, so a visitor can still navigate away. Its fallback
  is `src/components/error-fallback` (a shared primitive, not a feature component,
  because a render crash can occur in any feature): a localized, `role="alert"` apology
  with a retry control that calls the boundary's own `resetError` and a link home.
  `Sentry.ErrorBoundary#componentDidCatch` (`@sentry/react`) calls `captureReactException`
  itself, unconditionally, before it ever calls an `onError` prop — so wiring
  `reportRenderCrash` through `onError`, as every one of the three source drafts assumed,
  would `captureException` a _second_, independent event per crash, and neither event would
  carry both the SDK's own React `mechanism` metadata and our tags. `pages/_app.tsx`
  therefore tags the boundary's own capture instead of adding a second sink: a
  `beforeCapture` callback (`{ feature: 'app', action: 'render-crash' }`) sets the tags on
  the `Scope` the SDK is about to capture with, the same tag shape every other reported
  error in the app already carries. `reportRenderCrash` was removed from
  `src/lib/telemetry/report-error.ts` — it would have been dead code, since `beforeCapture`
  never calls it — and `reportHandledError` (`AuthLayoutTelemetry.test.tsx` already proves
  it sends no credential data) keeps its one real caller, the sign-up path.
- **One `ErrorLink`, no `RetryLink`, in `src/features/landing/api/graphql/apollo.ts`.**
  `new ErrorLink(({ error }) => reportHandledError(error, { feature: 'landing', action:
'graphql' }))` sits first in `ApolloLink.from([...])`, ahead of the Accept-Language link
  and `HttpLink`. It never returns a value, so it never retries and never changes what
  `handleApolloError` shows the visitor — it only reports. A retry link is explicitly out
  of scope: the sign-up form's own retry button already exists, and a link-level retry
  would double-submit a registration underneath it.
- **`release` and `environment` are added as sibling properties of the existing
  `Sentry.init` call**, sourced from `src/config/app-version.ts` (`APP_VERSION` from
  `package.json`, `APP_ENVIRONMENT` derived from the existing `isProductionBuild()` in
  `src/config/env.ts` rather than a new raw `process.env` read). `tracesSampleRate` drops
  to `0.1` in a production build and stays `1.0` in development — the 100% production trace
  sample #336 flagged as unsustainable. Neither change touches `sendDefaultPii` or the
  replay integration options; `sentry-app-observability.test.ts` (alongside
  `sentry-replay-masking.test.ts`) pins the new invariants with the same AST-parsing
  technique, and the replay spec's own assertions were re-run and are unchanged.

Out of scope, left to their own issues: a `RetryLink` of any kind; a brand-colour or
palette change to the fallback (#423); `pages/_document.tsx`, the skip link, or
`export-images.config.js` (the separate #322 UI batch); CodePipeline polling,
`out/version.json`, or a provenance workflow (the other half of #325).

## Consequences

### What this buys

One reporting sink instead of three competing ones, so every handled or caught error in
the app — a failed sign-up, a tripped honeypot, a GraphQL/network failure, an uncaught
render crash — carries the same `{ level: 'error', tags: { feature, action } }` shape and
the same credential-free payload guarantee. A render crash no longer takes the whole page
down: the header and footer stay usable, and the visitor gets a way back. Sentry events are
now attributable to a specific release and environment instead of one undifferentiated
stream, and production trace volume drops by 90%.

### What this costs

The error boundary only catches render-phase and lifecycle errors in `<Component />`'s
subtree, per React's error-boundary contract — an error inside `Layout`, the header, or an
event handler outside a `try`/`catch` still reaches no fallback and no report. The Apollo
`ErrorLink` reports but never retries, so a transient network blip that a retry link
would have silently recovered now surfaces to the visitor exactly as before this change;
that trade was deliberate (see Context) but is a real capability given up. Lowering
`tracesSampleRate` in production means 90% of production traces are simply never
collected, which narrows performance-tracing visibility in exchange for cost and volume
control.

### What would reverse it

A second interactive surface besides the sign-up form that needs its own retry semantics
would be the trigger to revisit the no-`RetryLink` decision. A traced-performance incident
that the 10% production sample cannot reconstruct would be the trigger to raise
`tracesSampleRate` again — paired with a plan for the resulting event volume, not a bare
revert.
