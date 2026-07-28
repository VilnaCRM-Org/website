# Edge security headers

How the production site emits its security headers, where the policy lives, and how
the CI gate keeps the two in sync. Introduced by issue #377 (OWASP A05:2021 Security
Misconfiguration, OWASP Secure Headers Project, ASVS V14.4).

## Why the edge

The site is a static export (`output: 'export'` in `next.config.js`), which makes the
Next.js `headers()` API a no-op — it only applies to a running Next server. The
CloudFront distribution in front of the S3 origin is therefore the only layer that can
attach headers to a response, so the policy is enforced by CloudFront Functions kept
in this repository.

Do **not** try to reintroduce `headers()` in `next.config.js`: it silently does
nothing under `output: 'export'`.

## The policy

[`config/security-headers.json`](../config/security-headers.json) is the single source
of truth. Every other artifact is checked against it.

- `content-security-policy: frame-ancestors 'none'` — blocks framing (clickjacking)
  of the consent + password sign-up form.
- `x-frame-options: DENY` — the same protection for user agents that predate CSP
  `frame-ancestors`.
- `x-content-type-options: nosniff` — stops MIME sniffing turning a static asset into
  an executable document.
- `referrer-policy: strict-origin-when-cross-origin` — keeps full URLs (and any query
  data) from leaking to third-party origins.
- `strict-transport-security: max-age=63072000; includeSubDomains; preload` — after the
  first HTTPS response, pins the origin and its subdomains to HTTPS for two years, so a
  later downgrade attempt never carries form input. `preload` is the opt-in signal for
  the browser preload list; until `vilnacrm.com` is actually submitted to and accepted by
  <https://hstspreload.org>, the very first contact with a host is still unprotected.

The `script-src` / `connect-src` half of the CSP (gtag, Sentry) is deliberately **not**
in this policy — it is owned by the client-side hardening issue and needs its own
rollout with report-only monitoring. Adding it here later is a value change in
`config/security-headers.json` plus the matching edge functions.

## Where the policy is applied

- Every page, asset, and origin error — `scripts/cloudfront_security_headers.js`
  (viewer-response event).
- The synthetic 404 for unknown top-level paths — `scripts/cloudfront_routing.js`
  (viewer-request event).

Two functions are needed because CloudFront does **not** run the viewer-response
function when a viewer-request function short-circuits with its own response. The
synthetic 404 built in `cloudfront_routing.js` therefore carries the same header set
inline, and `make lint-headers` proves both copies match the policy file.

Values are set, not merged, so an origin response can never weaken or drop a header.

## CloudFront association (out-of-repo infrastructure)

The distribution itself is managed outside this repository. Associate both functions
with the default cache behaviour:

| Function source                          | CloudFront event type |
| ---------------------------------------- | --------------------- |
| `scripts/cloudfront_routing.js`          | Viewer request        |
| `scripts/cloudfront_security_headers.js` | Viewer response       |

A CloudFront **response headers policy** carrying the same values is an equally valid
enforcement point; if one is adopted, keep `config/security-headers.json` as the
reviewed source and mirror it there.

## The CI gate

`make lint-headers` (part of `make lint`, so it runs in the static testing workflow on
every PR) executes the checked-in edge functions and fails if any policy header is
missing or altered:

```bash
make lint-headers
```

It checks three things:

1. The policy in `config/security-headers.json` still meets the baseline encoded in
   `scripts/ci/lint-headers.mjs`: `frame-ancestors 'none'` and `X-Frame-Options: DENY`
   exactly (`'self'` / `SAMEORIGIN` are rejected — they would still permit same-origin
   framing), `nosniff`, a `Referrer-Policy` from the non-leaking set, and HSTS with
   `max-age` of at least one year plus `includeSubDomains` and `preload`. Weakening the
   policy therefore requires editing that baseline in the same reviewed diff.
2. The viewer-response function emits every policy header, with the exact value, on a
   page response, an asset response, and an origin error response.
3. The synthetic 404 from the routing function carries the same headers.

The gate reasons about the checked-in handlers, not about production: it cannot see
whether the functions are associated with the distribution. That is the post-deploy
smoke test's job (below).

Behaviour is additionally pinned by the edge unit layer
(`make test-unit-edge`, 100% coverage) in `src/test/edge/`.

After a deploy, the `post-deploy smoke test` job in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) probes the live site
with `curl -I` on `/` and on `/favicon.svg` and fails if the deployed distribution does
not return the policy — that is what catches a missing function association, which no
in-repo check can see.

## Verifying by hand

```bash
curl -fsSI https://vilnacrm.com/ | grep -Ei 'content-security-policy|x-frame-options|strict-transport-security|x-content-type-options|referrer-policy'
curl -fsSI https://vilnacrm.com/favicon.svg | grep -Ei 'content-security-policy|x-frame-options'
```

## Changing the policy

1. Edit `config/security-headers.json`.
2. Mirror the value in `scripts/cloudfront_security_headers.js` and in the
   `SECURITY_HEADERS` table of `scripts/cloudfront_routing.js`.
3. Run `make lint-headers` and `make test-unit-edge`.
4. Re-deploy; the post-deploy smoke test verifies the live responses.

Never relax a header to make a gate pass — fix the cause instead.
