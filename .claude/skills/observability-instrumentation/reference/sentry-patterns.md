# Sentry Patterns

`Sentry.init()` runs once, in `pages/_app.tsx`, from `@sentry/react`. Treat that
call as the single configuration point — do not re-init or scatter raw SDK calls
across components.

## Capture boundaries

- **App / route boundary** — a `Sentry.ErrorBoundary` (see
  [../examples/frontend-error-boundary.md](../examples/frontend-error-boundary.md))
  catches render-time failures and shows a localized fallback.
- **Apollo Client 4 `api/` layer** — surface GraphQL or network errors where the
  feature already owns the request (for example `src/features/landing/api/`), not
  in the components that render the data.
- **Typed helpers** — an explicit `captureException` in the `catch` of a hook or
  helper, wrapped so a telemetry failure cannot bubble into the user flow.

## Tags and context

Use low-cardinality tags so Sentry groups issues well, and put variable detail in
`extra`:

```ts
import * as Sentry from '@sentry/react';

export function reportRegistrationFailure(error: unknown, statusCode?: number) {
  Sentry.captureException(error, {
    tags: { feature: 'registration', surface: 'auth-form' },
    extra: { statusCode },
  });
}
```

- `feature` — the `src/features/<feature>` the failure came from.
- `surface` — a coarse area such as `app`, `auth-form`, or `swagger`.
- `route` — the pathname, when it adds grouping value.

Keep user-typed text and identifiers out of both `tags` and `extra` — see
[privacy-checklist.md](privacy-checklist.md).

## Sampling

The live rates are declared in the single `Sentry.init` in `pages/_app.tsx`:
`tracesSampleRate` (performance traces), `replaysSessionSampleRate`, and
`replaysOnErrorSampleRate`. Error capture is unsampled — you want every
exception. Tune trace and replay volume in that file; never override sampling per
call. Treat `pages/_app.tsx` as the source of truth.

## Context rules

Allowed:

- Route or pathname.
- Feature / surface name.
- Coarse error category.
- Non-sensitive HTTP status codes.

Avoid:

- Passwords, tokens, cookies, and auth headers.
- Full request or response bodies.
- Raw react-hook-form field values (email, name, password).
- Any free text the user entered.
