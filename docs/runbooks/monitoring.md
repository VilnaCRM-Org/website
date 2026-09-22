# Monitoring runbook

What watches the production website and the `main` branch, where each signal lands, and
— just as important — what is wired but currently inert (issue #336). Every claim below
was checked against the tree it ships in; when a section says a check "skips" or "sends
nothing", that is the current state, not a warning about a hypothetical one.

## Where alerts land

Every automated alert in this repository is a GitHub issue on a label. There is no pager,
no chat integration and no status page; watching the labels below **is** the on-call
surface. Subscribe to them, or to the repository's issues, to be told about anything.

- `uptime-alert` — filed by `uptime-check.yml`. Production is failing its synthetic
  check. Start with the [incident response runbook](incident-response.md).
- `ci-alert` — filed by `ci-health-alerts.yml` and `release-audit.yml`. A monitored
  post-merge workflow failed, `main` is red, or a release anomaly was recorded.
- `release-audit` — the permanent ledger issue `release-audit.yml` appends to: one comment
  per release and per bot push.
- `ci-canary` — `docker-build-canary.yml`. The nightly Docker build canary is red,
  usually because an Alpine package pin rotated.
- `e2e-flake` — `e2e-flake-census.yml`. Nightly census of e2e specs that pass only on a
  retry.
- `dependency-cve` — `osv-scanner.yml`. Nightly census of the dependency CVE backlog.
- `mutation-backlog` — `mutation-testing.yml`. Nightly full mutation census.
- `api-contract` — `openapi-drift.yml`. Breaking upstream OpenAPI or GraphQL drift
  against the pinned user-service contracts.
- `docs-release-hygiene` — `link-check.yml`. Weekly external link failures.
- `test-effectiveness` — `fuzz-testing.yml`. Nightly fuzz findings.

Only the first two labels concern production availability. The rest are engineering
hygiene: they never page anyone and never block a merge.

## Production availability

### The synthetic uptime check

[`.github/workflows/uptime-check.yml`](../../.github/workflows/uptime-check.yml) runs
every thirty minutes and on `workflow_dispatch`. It probes the origin named by the
`PRODUCTION_SITE_URL` repository variable when one is set, and otherwise the committed
canonical origin `https://vilnacrm.com` — the one
[`public/.well-known/security.txt`](../../public/.well-known/security.txt) publishes as
`Canonical`. That fallback is deliberate: the post-deploy smoke below reads the same
variable, and because the variable was never set the smoke has skipped on every deploy so
far. The uptime check is live without any repository configuration.

Two scripts run, and both always report:

- **Positive path** — [`scripts/ci/uptime-check.sh`](../../scripts/ci/uptime-check.sh).
  `GET /` and `GET /swagger` must each answer `200`, with a `content-type` of
  `text/html` (case-insensitive, every value if the header repeats) and a non-empty body.
  A `200` with an `application/xml` body is an S3 error document, not the site, which is
  why the status alone is not trusted.
- **Negative path** —
  [`scripts/ci/smoke-response-shape.sh`](../../scripts/ci/smoke-response-shape.sh), the
  same script the deploy smoke runs. An unknown URI must produce the site's own `404`
  with a body and `text/html` — every production incident this site has had was on that
  path (#226, #229, #235, #249).

Each script retries four times, fifteen seconds apart, so one dropped connection is not
an outage and a real outage is not hidden until the next run. On any failure the workflow
files **one** issue titled `Uptime: the production site is failing its synthetic check`
on the `uptime-alert` label, or comments on it if it is already open, and marks the run
red. The next fully green run comments `Recovered` and closes it. Dedup is by exact title
over the open issues on that label, so a renamed issue never absorbs a new outage.

The check is keyed on the probe outcomes, not on the run failing: a broken checkout or a
`gh` outage leaves the run red in the Actions tab without filing a false incident. So a
red `uptime check` run with no open `uptime-alert` issue means the workflow itself is
broken, not the site.

Run it by hand at any time from the Actions tab (`uptime check` → _Run workflow_), or
locally:

```bash
UPTIME_ATTEMPTS=1 ./scripts/ci/uptime-check.sh https://vilnacrm.com
SMOKE_ATTEMPTS=1 ./scripts/ci/smoke-response-shape.sh https://vilnacrm.com
```

### The post-deploy smoke test (wired, currently skipped)

[`deploy.yml`](../../.github/workflows/deploy.yml)'s `post-deploy-smoke` job probes the
live site after every push to `main` — the same positive markers, the full
security-header policy on a page and an asset, and the negative path. The
[deployment runbook](../deployment-runbook.md#post-deploy-smoke-test) describes every
assertion.

It is gated on `vars.PRODUCTION_SITE_URL != ''`, and that variable has never been set (the
repository's only variables are `NODE_VERSION` and `PROD_BUCKET_NAME`), so **the job has
skipped on every production deploy to date**. Nothing verifies that what shipped works
until the next scheduled uptime run, up to thirty minutes later. The sandbox twin in
`sandbox-creating.yml` is gated on `SANDBOX_SITE_URL_TEMPLATE` and is skipped for the same
reason.

To arm it, follow
[the one-time setup](../deployment-runbook.md#one-time-setup) in the deployment runbook.
A failed smoke then reaches the `ci-alert` label through `ci-health-alerts.yml`, which
lists the `website` workflow (see the next section).

## CI health and the release ledger

### `ci-health-alerts.yml`

Listens through `workflow_run` to the deploy (`website`), release, CodeQL, secrets-scan
and dev-container workflows, files or refreshes a `ci-alert` issue when one of them fails
on `main`, closes it on recovery, and sweeps `main` daily at 06:00 UTC for a red
default branch. `make lint-prod-guardrails` fails a pull request if a privileged workflow
runs on a non-pull-request trigger without being listed there.

Until issue #325 it had never delivered: the workflow had no checkout step and set no
`GH_REPO`, so every `gh issue list` in it failed with
`failed to run git: fatal: not a git repository` (93 of its last 100 runs red, no
`ci-alert` ever filed), and the release lane had been red on every push since 2026-08-27
with nobody told. The alert logic now lives in `scripts/ci/ci-health-alert.sh`, which
exports `GH_REPO` once and is also set at job level in the workflow; the script is
checked out sparsely with `persist-credentials: false`. `tests/bats/ci_health_alerts.bats`
drives every path against a stubbed `gh` — filing, refreshing by exact title, the
stale-success guard, the red-main sweep, the digest — and `security_workflows.bats` reads
the job-level env back with js-yaml, so the repository context cannot silently drop out
again. A `workflow_dispatch` trigger with a `dry_run` input (default `true`) exercises the
real API path from any branch without writing anything; set `dry_run=false` only to file
a real alert on purpose.

### `release-audit.yml`

Records every published release and every push to `main`, including the autorelease
bot's, as one comment each on the permanent `Release and bot-push audit log` issue
(label `release-audit`), and escalates anomalies — a deleted release, an unexpected bot,
a force-push — onto `ci-alert`. Read
[what the ledger cannot prove](../release-audit.md#what-the-ledger-cannot-prove) before
treating a record as evidence.

### Logs outside this repository

The GitHub Actions log of a `website` run shows only that CodePipeline was **triggered**.
The build and the publish to S3 happen in the AWS account, asynchronously, and their logs
are in CloudWatch under the pipeline's log groups — see
[Monitoring and Logging Recommendations](../../.github/website_deployment.md#monitoring-and-logging-recommendations)
in the deployment notes. Access to that account is held by the infrastructure
maintainers, not granted by this repository.

## Application telemetry — wired, currently sending nothing

The browser bundle carries the instrumentation; production has no keys for it to send to.

- **Sentry.** [`pages/_app.tsx`](../../pages/_app.tsx) calls `Sentry.init` from
  `@sentry/react` with `dsn: env.NEXT_PUBLIC_SENTRY_DSN`, read through the zod-validated
  schema in [`src/config/env.ts`](../../src/config/env.ts) (default `''`),
  `sendDefaultPii: false`, session replay pinned to mask all inputs, text and media, trace
  propagation only to the configured API origins, `release`/`environment` sourced from
  [`src/config/app-version.ts`](../../src/config/app-version.ts) (the `package.json`
  version and `isProductionBuild()`), and sampling of `tracesSampleRate: 0.1` in a
  production build (`1.0` in development), `replaysSessionSampleRate: 0.1`,
  `replaysOnErrorSampleRate: 1.0`. [`.env.production`](../../.env.production) commits
  `NEXT_PUBLIC_SENTRY_DSN=` **empty**, so the production bundle initialises the SDK with no
  DSN and it sends nothing. Handled errors — the sign-up path, a caught Apollo
  GraphQL/network error (`src/features/landing/api/graphql/apollo.ts`'s `ErrorLink`, which
  only reports and never retries) and an uncaught render crash — carry the same static
  `feature`/`action` tag shape. The sign-up path and the Apollo `ErrorLink` report through
  the single sink [`src/lib/telemetry/report-error.ts`](../../src/lib/telemetry/report-error.ts).
  A render crash inside a page is caught by the `Sentry.ErrorBoundary` wrapped around
  `<Component />` (not around the header or footer, so both stay usable): the boundary
  captures the event itself, so `pages/_app.tsx` tags that single capture via
  `beforeCapture` (`{ feature: 'app', action: 'render-crash' }`) instead of adding a second
  `captureException` call, and shows
  [`src/components/error-fallback`](../../src/components/error-fallback), a localized,
  `role="alert"` apology with a retry control and a link home. See
  [ADR 0009](../adr/0009-consolidated-error-boundary-and-observability.md) for the design
  this consolidates.
- **Core Web Vitals.** `reportWebVitals` in `pages/_app.tsx` delegates to
  [`src/lib/web-vitals/report-web-vitals.ts`](../../src/lib/web-vitals/report-web-vitals.ts),
  which forwards only field vitals (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`), only in a
  production build, at a 10% sample, as `name`/`id`/`value` to GA4 and
  `Sentry.setMeasurement`. It runs in production today and reaches nobody, for the two
  reasons above and below.
- **Google Analytics.** `<GoogleAnalytics>` renders only when
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` is non-empty; `.env.production` commits it empty.
- **Console.** `compiler.removeConsole` in [`next.config.js`](../../next.config.js) strips
  `console.log`/`debug` from the production bundle but keeps `console.error` and
  `console.warn`, so the browser console is still a diagnostic channel on a live page.

What unblocks each: a maintainer supplies the real Sentry DSN and GA measurement id. Both
are public client-side keys, and `.env.production` is where every other `NEXT_PUBLIC_*`
production value is committed — see the comments in
[`.env.example`](../../.env.example). `src/test/unit/client-env-contract.test.ts` requires
both keys to stay declared in `.env` and `.env.production`.

## Known gaps

- **No status page.** There is nothing customer-facing to update during an incident. The
  `uptime-alert` issue is the only record, and it is visible to whoever watches the
  repository. Adding one is an infrastructure decision outside this repository.
- **One vantage point.** The uptime check runs on a GitHub-hosted runner. A regional CDN
  fault it cannot see, a GitHub Actions outage, or a delayed schedule (GitHub does not
  guarantee cron timing under load) each read as silence rather than as an alert.
- **Thirty-minute detection window** at best, and no post-deploy verification at all until
  `PRODUCTION_SITE_URL` is set.
- **No production error telemetry** until the Sentry DSN is committed, and no error
  boundary even then.
- **CI health alerting is only as good as the run that fires it.** `ci-health-alerts.yml`
  files on a failed `workflow_run` and on the daily red-main sweep; a workflow that is
  cancelled, skipped, or never listed there fails silently. `make lint-prod-guardrails`
  guards the list, not the outcome.
- **Old build or new build?** A probe cannot tell whether the document it received is the
  one the last deploy published; the ledger records what was pushed, not what is served.
