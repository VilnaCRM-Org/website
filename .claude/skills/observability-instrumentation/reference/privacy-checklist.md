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

When event shape cannot be guaranteed, scrub in the single `Sentry.init` in
`pages/_app.tsx` with `beforeSend`, so nothing sensitive leaves the browser:

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN_KEY,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});
```

Prefer not collecting sensitive data in the first place; treat `beforeSend` as a
backstop, not the primary control.
