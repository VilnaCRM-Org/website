# ADR 0001: Ship a static export to S3 + CloudFront, deployed by CodePipeline

- **Status:** Accepted
- **Date:** 2026-09-09 (backfilled; the decision predates this log)
- **Deciders:** website maintainers
- **Related:** issues #341, #377, #363, #383

## Context

The site is a public marketing landing plus an interactive Swagger page. It has no
authenticated area, no per-request personalisation, and no server-side data of its own:
the only backend it talks to is the user service, reached from the browser through Apollo
Client. The runtime alternatives were a Node server (SSR/ISR on a container or a
serverless platform) or a pre-rendered bundle on object storage behind a CDN.

Operating a Node origin means keeping a runtime patched, scaled, and observable for pages
whose HTML never varies per request. Object storage behind a CDN has no origin to patch
and no cold start, and the AWS account already runs CodePipeline for the organisation's
other services.

## Decision

We build the site as a fully static export and serve it from S3 through CloudFront.

- `next.config.js` sets `output: 'export'`, wrapped in `next-export-optimize-images`;
  `make build-out` produces the artifact in `./out`.
- Every push to `main` runs [`deploy.yml`](../../.github/workflows/deploy.yml), which
  assumes an AWS role via OIDC and calls
  `aws codepipeline start-pipeline-execution --name ci-cd-website-prod-pipeline`.
  CodePipeline builds and publishes **asynchronously**; the GitHub job finishes when the
  pipeline is triggered, not when the build is live. The operational detail is in the
  [deployment and rollback runbook](../deployment-runbook.md).
- Request-time behaviour that a server would normally provide moves to CloudFront
  functions committed in this repository: `scripts/cloudfront_routing.js` (routing plus a
  fail-closed allow-list that returns a synthetic 404 for anything not exported) and
  `scripts/cloudfront_security_headers.js` (the headers declared in
  `config/security-headers.json`).
- Offline behaviour is a service worker, `public/sw.js`, which precaches exactly one
  document (`/offline.html`) and serves it only when a same-origin navigation fails.

## Consequences

### What this buys

No origin server to run, patch, or scale. CloudFront terminates and serves every
request — a cache hit is answered at the edge, and a miss costs one fetch from the
static S3 origin rather than a render — which is what keeps the desktop Lighthouse
budgets in `lighthouserc.desktop.js` reachable. The whole
deploy surface is reviewable in-repo, and rollback is re-publishing a previous artifact.

### What this costs

- **Next's `headers()` is a no-op under `output: 'export'`.** Security headers exist only
  because an edge function applies them, which is why `make lint-headers` executes the
  committed functions against representative responses (issue #377) and the post-deploy
  smoke test probes the live response (issue #363). Nothing in the repository can observe
  whether CloudFront actually associates those functions.
- **Every route is client-rendered on first paint for the parts loaded with
  `ssr: false`.** That is the binding constraint on the mobile Lighthouse score
  documented at length in `lighthouserc.mobile.js`: on Moto G4 emulation the LCP element
  does not exist until the bundle has hydrated, and no budget tightening moves the score
  past roughly 0.6 while that holds.
- **The routing allow-list is a maintenance obligation.** A newly exported path that is
  not in `ROUTE_MAP` / `ALLOWED_FILES` / `ALLOWED_DIRS` is 404ed in production, so
  `scripts/ci/verify-edge-allowlist.mjs` has to replay the real handler over every file
  in `out/` on each PR.
- **Deploys are fire-and-forget.** GitHub reports success before the artifact is live, so
  the post-deploy smoke job, not the deploy job, is the real signal.
- **No server-side redirects, rewrites, or per-request logic** without writing another
  edge function and getting it associated by the infra repository.

### What would reverse it

Needing authenticated or personalised HTML, per-request A/B rendering, or server-side
rendering of the landing shell to lift the mobile score — the last of which is the
explicit step 2 of the ratchet plan in `lighthouserc.mobile.js` and can be done inside
this decision only if it stays build-time.
