# Edge routing

Why `scripts/cloudfront_routing.js` is shaped the way it is, how it reaches CloudFront, and
why its rationale lives here rather than in the file. The companion for the response side
is [`security-headers.md`](security-headers.md); the decision to put a static export behind
S3 and CloudFront at all is [ADR 0001](adr/0001-static-export-s3-cloudfront.md).

## The 10 KB budget

CloudFront Functions cap a function at **10 KB of source**, and the quota is not adjustable.
The file is published verbatim, so a comment costs exactly what code costs. The routing
script crossed that line in September 2026 after three PRs (#464, #467, #470) each added a
paragraph of rationale: it reached ~13 KB, the infra apply could not publish it, and the
distribution kept the version it already had — which is how the `/en` rewrite existed in
`main` while `https://vilnacrm.com/en` returned 404.

`make lint-prod-guardrails` (assertion D in `scripts/ci/lint-prod-guardrails.mjs`) now
fails a PR when either edge function exceeds 10,000 bytes. AWS writes the quota as
"10 KB" without saying which kilobyte it means, so the gate takes the stricter reading.
`tests/bats/prod_guardrails.bats` proves the gate red on a file padded with nothing but a
comment, and on a multi-byte comment that stays under 10,000 characters while exceeding
10,000 bytes. Keep the two scripts to code plus a pointer here; put the reasoning in this
document, the ADR, or the spec that pins the behaviour. Never raise the limit — AWS will
not honour it.

## How the function reaches CloudFront

Nothing in this repository deploys the function. `.github/workflows/deploy.yml` only
starts the website CodePipeline, which builds the export and syncs it to S3. The function
itself is a Terraform resource in the `website-infrastructure` repository
(`terraform/app/modules/aws/cloudfront/function.tf`): an `aws_cloudfront_function` whose
`code` is an HTTP fetch of the raw `scripts/cloudfront_routing.js` on this repository's
`main` branch, with `publish = true`, associated with the distribution's default cache
behaviour on the `viewer-request` event.

Two consequences follow:

- **A `ROUTE_MAP` change is not live after a website deploy.** It goes live when someone
  runs a Terraform plan and apply of the website stack against the production account and
  the plan shows the function's `code` changing. Until then the CDN runs the previously
  applied version, and only the post-deploy smoke test — which needs the
  `PRODUCTION_SITE_URL` repository variable to be set — can tell the difference.
- **Terraform reads `main`, not a tag or a branch.** The size fix, or any routing change,
  has to be merged before the plan is run, and the plan should show exactly one change.

The same module declares no resource for `scripts/cloudfront_security_headers.js` as of
September 2026, so the viewer-response association described in
[`security-headers.md`](security-headers.md) is a target state until the post-deploy
header probe confirms it. `docs/deployment-runbook.md` carries the operator-facing version
of this.

## Fail-closed by construction (issue #383)

A URI reaches the S3 origin only if it is an exact `ROUTE_MAP` route, an exact
`ALLOWED_FILES` entry, or sits under an `ALLOWED_DIRS` top-level directory **and** carries
an `ALLOWED_EXTENSIONS` extension. Everything else receives the synthetic 404.

Before #383 the function was default-allow: any URI whose last path segment contained a
`.`, and any unknown multi-segment path, was passed straight through. `/secret.json`,
`/.env`, `/backup/db.sql` and `/*.map` all reached the bucket, so origin protection rested
entirely on the S3 bucket policy — and unmapped paths leaked S3's native AccessDenied XML
instead of this site's 404.

The three tables describe the static export in `out/`, and two gates hold them to it:

- `scripts/ci/verify-edge-allowlist.mjs` runs the real handler over every file of a
  freshly built export and fails if any shipped path is blocked. If it fails, add the new
  path; never widen a table beyond what the export ships.
- `ROUTE_MAP` is additionally held to `config/routes.json` (generated from `pages/`) by
  `src/test/unit/routes/route-manifest.test.ts`, and every rewrite target is proved to
  exist in a real export by the same allow-list gate (issue #333). A rewrite replaces the
  URI instead of granting access, so a target with no object behind it serves S3's raw
  error document rather than the synthetic 404 — which is what `/about` and `/en` did
  before #333, when they pointed at `index.html` objects a `trailingSlash`-less export
  never writes.

### The tables

- **`ROUTE_MAP`** — extensionless URLs mapped to the object the export actually writes.
  `next.config.js` leaves `trailingSlash` unset, so the export is flat: one
  `<route>.html` per route, `/` being the only route whose object is an `index.html`.
  `/en` is a real route since the English landing (`pages/en/index.tsx`) and, like every
  other non-root route, its object is the flat `/en.html`. The manifest is deliberately
  the wider set: `/offline` is exported but intentionally unmapped, because the service
  worker precaches the fallback as `/offline.html` (see
  [`offline-shell.md`](offline-shell.md)).
- **`ALLOWED_DIRS`** — top-level directories of the export that may serve files.
- **`ALLOWED_FILES`** — exact root-level paths. Root files are exact-matched rather than
  extension-matched so an unexported `/secret.json` cannot ride in on the legitimate
  `/swagger-schema.json`. `/en.html` needs its own entry: the `en` directory entry covers
  `/en/docs/api.html`, not a flat root file. `/offline.html` and `/sw.js` are what publish
  the offline shell and its worker (issue #338). `/.well-known/security.txt` is listed
  exactly because `.well-known` is not an allowed directory and `txt` is not an allowed
  extension — tighter than opening a `.well-known` prefix.
- **`ALLOWED_EXTENSIONS`** — extensions the export actually ships. `json` is absent on
  purpose: the only exported `.json` is root-level and exact-matched above, so
  `/anything/x.json` is blocked. `map` must never be added: browser source maps are off
  (`productionBrowserSourceMaps` is unset, enforced by `make lint-prod-guardrails`) and
  publishing them would leak the sources.

### Own-property lookups

Every table lookup goes through `Object.prototype.hasOwnProperty.call`, so inherited names
(`toString`, `constructor`, `__proto__`) can never be mistaken for an allow-listed entry.

### Escapes and dot segments are rejected, not decoded

CloudFront hands the function the URI still percent-encoded and never normalises dot
segments, so both are checks the tables cannot make for themselves. `/images/%2Eenv.js`
has a last segment starting with `%`, not `.`, so the extension reads as a plain `js` and
the dotfile test never fires — yet S3 percent-decodes the path to derive the object key
and serves `images/.env.js`. `%2F` is worse still: it moves where the last segment even
begins (`/images/a%2F.env.js` becomes `images/a/.env.js`).

Decoding in the handler would need its own `try/catch`, because `decodeURIComponent`
throws on a malformed escape such as `%zz`, and a throw inside the handler is caught and
**fails open** to the origin. So the whole escaped family is rejected outright, and a `.`
or `..` segment is rejected for the same reason: it satisfies the directory and extension
tests while resolving somewhere else entirely. Nothing in the export carries a `%` in its
name — `verify-edge-allowlist.mjs` proves that on every PR — so this costs the site
nothing.

The extension test itself treats `lastDot <= 0` as "no extension" and any last segment
starting with `.` as a dotfile, including one carrying a second dot (`/images/.env.js`), so
dotfiles are never treated as carrying an extension.

## The synthetic 404

Every blocked or unknown path returns one response, built in one place. Past incidents
each came from a response missing one field: #249 (no `body`, which CloudFront turned into
a 5xx) and #235 (no `content-type`, which made Safari download the page). Routing every
404 through the same builder is also what keeps the security headers on the fail-closed
404s that #383 added — a viewer-response function never runs for a response the
viewer-request function returns itself, so the header set is carried inline and verified
against `config/security-headers.json` by `make lint-headers` (issue #377).

The document is branded and self-contained (issue #339): a viewer-request function returns
a body, it cannot fetch one, so the string is the whole response — no stylesheet, no font,
no script. Every rule is inline, and the colours are the site's own (`#1A1C1E` is
`darkPrimary` in `src/components/ui-color-theme`, on the white ground the site uses), so
the page reads as this site rather than as a storage error. That pair measures 16.8:1,
well past the 4.5:1 WCAG 2.1 AA needs, which matters because no stylesheet can arrive to
correct it.

It stays English-only on purpose. The handler runs before anything knows which of the
site's two locale bundles the visitor would have been served, and negotiating
`accept-language` here would put a parser in front of every 404 to translate one sentence.
The link resolves that: `/` is served by the site itself, which applies its own locale.

`pages/404.tsx` is the same content rendered inside the real site chrome and exported to
`/404.html`. It is **not** what this handler serves, and the two need not match word for
word: a viewer-request function can rewrite the URI or return a response, and a rewrite
would serve that document with a `200` — the soft 404 that tells a crawler a mistyped
address is a real page. `/404.html` reaches visitors as the S3 bucket's error document;
the inline string is what CloudFront returns for everything the allow-list rejects. See
[`seo-surface.md`](seo-surface.md#error-documents).

## The error path fails open

A bug in the handler must never black-hole the site. The handler catches, logs, and
returns the original request, so an unexpected throw sends the request to the S3 origin
instead of to the synthetic 404. That is the one comment left at its point of use, and
the trade-off is recorded in ADR 0001: a narrow, logged failure window in exchange for
availability.

## Where the contract is proved

- `src/test/edge/cloudfront-routing.test.ts` — the `edge` Jest layer, gated at 100%
  per-file coverage (`make test-unit-edge`). It vm-loads the exact file and pins the full
  404 shape, every allow-listed export path, and the fail-closed rejections.
- `scripts/ci/lint-prod-guardrails.mjs` — the tables are still declared and frozen, the
  synthetic 404 still exists, `map` is absent, the handler's `try` block does not end in
  an unconditional origin pass-through, and both functions fit the quota.
- `scripts/ci/verify-edge-allowlist.mjs` — completeness and minimality against a real
  export.
- `scripts/ci/smoke-response-shape.sh` — the deployed distribution's negative path,
  after every production deploy once `PRODUCTION_SITE_URL` is set.
