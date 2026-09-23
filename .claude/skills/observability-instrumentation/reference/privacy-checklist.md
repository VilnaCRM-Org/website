# Privacy Checklist

Telemetry on this site must never carry user-identifying or secret data. Walk
this list before adding any Sentry capture, web-vitals payload, or log.

- [ ] No tokens, passwords, cookies, or auth headers.
- [ ] No raw react-hook-form field values (email, name, password).
- [ ] No full GraphQL or HTTP request/response bodies.
- [ ] No free text the user typed.
- [ ] User identifiers are avoided or minimized.
- [ ] Context is feature-level (route, feature, surface) unless more detail is
      genuinely required.
- [ ] i18next keys are reported, never the rendered localized string (which may
      contain PII).
- [ ] A telemetry failure cannot block the user flow.

## Payload contract

Allowed fields: route/pathname, feature name, `surface`, coarse error category,
non-sensitive HTTP status codes, and i18next keys.

Forbidden fields: credentials and tokens, cookies, auth headers, raw form input,
full request/response bodies, and any free-form user text.

## Scrubbing at the boundary

The single `Sentry.init` in `pages/_app.tsx` wires two pure, typed scrubbers from
`src/lib/telemetry/`, so nothing sensitive leaves the browser even when an
event's shape cannot be guaranteed:

```ts
Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
```

- **`scrubEvent`** (`scrub-event.ts`, `beforeSend`) keeps the event useful and
  removes only what can carry user data:
  - `request` is rebuilt from `url` (query string and fragment stripped),
    `method` and the `User-Agent` header — body `data`, `cookies`,
    `query_string`, `env` and every other header are dropped.
  - `extra` and `contexts` are walked recursively; keys named `variables`,
    `input`, `password`, `email`, `initials`, `body`, `cookie(s)`,
    `authorization` or `token` are dropped at any depth, case-insensitively,
    and any string value that is an absolute `http(s)://` URL loses its query
    string and fragment.
  - The walk is bounded so it can never stall the page: at most 8 levels deep,
    100 entries per object or array (the rest become one `[truncated]`
    marker), and 1,000 objects per walk. An object already walked — a cycle or
    a shared reference — becomes `[repeated]` instead of being expanded again.
    The email pattern is bounded to the RFC 5321 lengths (64-character local
    part, 63-character labels), so a long run of address characters scans in
    linear time.
  - Email-shaped substrings in `message`, `logentry` (message and params),
    exception values and any remaining string are replaced with `[email]`. The
    rest of each message is kept, so a server error such as "A user with email
    [email] already exists." still groups and reads well.
  - `user` keeps only its `id`; every breadcrumb goes through `scrubBreadcrumb`.
- **`scrubBreadcrumb`** (`scrub-breadcrumb.ts`, `beforeBreadcrumb`) keeps only
  `method`, `status_code` and a query-free `url` on `fetch`/`xhr` breadcrumbs
  (so a recorded request payload never survives), only a query-free `from` and
  `to` on `navigation` breadcrumbs, and only `logger` on `console` breadcrumbs —
  the raw logged `arguments` are dropped, since the redacted `message` already
  carries their text. Every other breadcrumb's `data` is scrubbed like `extra`,
  and every `message` has its emails redacted.
- **Why both hooks.** `beforeSend` sees the breadcrumbs attached to an error
  event, but session replay records breadcrumbs through the SDK's
  `beforeAddBreadcrumb` client hook, which fires _after_ `beforeBreadcrumb` and
  never passes through `beforeSend`. Only `beforeBreadcrumb` covers both.
- **Not scrubbed:** transaction events (`beforeSendTransaction`); they carry span
  names and URLs, not form values.

`src/test/unit/telemetry/` pins the scrubbers, including a spec that runs the
real SDK through the real Apollo `ErrorLink` on a failed sign-up and asserts the
sent envelope carries no form value. `src/test/unit/sentry-app-observability.test.ts`
fails if either hook is removed from `Sentry.init` or stops naming these modules.

Prefer not collecting sensitive data in the first place; treat the scrubbers as a
backstop, not the primary control. Never pass form values to `captureException`
because "the scrubber will catch it" — it only recognises the shapes listed above.
