# Deployment and rollback runbook

How the VilnaCRM website reaches production, how the post-deploy smoke test
verifies a release, and how to roll back a bad deploy.

## How a production deploy works

Every push to `main` triggers
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). The `deploy`
job assumes an AWS role through OIDC and calls
`aws codepipeline start-pipeline-execution` on the `ci-cd-website-prod-pipeline`
pipeline. CodePipeline then builds the static export and publishes it to the CDN
**asynchronously** — the GitHub job finishes once the pipeline is _triggered_,
not once the new build is live.

The `deploy` job runs inside the `production` GitHub Environment so the release
can be gated by environment protection rules (see below).

## Post-deploy smoke test

After `deploy` succeeds, the `post-deploy-smoke` job probes the live site and
fails if it does not serve valid content:

- `GET /` — expects HTTP `200` and HTML containing `__next` (the Next.js root)
  or a `<title>`.
- `GET /swagger` — expects HTTP `200` and a body mentioning `swagger`.
- `HEAD /` and `HEAD /favicon.svg` — expect every header in
  `config/security-headers.json` (see
  [the security-headers guide](security-headers.md)). This is the only check that
  can catch the CloudFront functions being unassociated from the distribution; the
  in-repo `make lint-headers` gate only proves the functions themselves are correct.
- `GET /smoke-nonexistent-…` — the **negative** path, run through
  `make smoke-prod SITE_URL=…` (a thin host-only wrapper around
  `scripts/ci/smoke-response-shape.sh`, issue #331) so the deploy workflow's
  command surface stays Makefile-only, issue #363. Blocks on three assertions,
  each of which is a production incident this site has already had: the status is
  exactly `404` and not `500` (#226, and again #229), the body is non-empty (#249),
  and `content-type` is `text/html` (#235 — without it Safari _downloads_ the 404).
  The security-header check on that same response, and the sandbox `noindex` check,
  emit `::warning::` rather than failing; the script states the condition for
  promoting them to blocking. Runs last, so a failure here cannot stop the header
  step above from reporting.

Because CodePipeline deploys asynchronously, each probe retries until the CDN
serves the new build or the job times out. The readiness probes allow roughly ten
minutes; the negative-path probe allows twelve attempts fifteen seconds apart,
overridable with `SMOKE_ATTEMPTS` and `SMOKE_DELAY`.

That ten-minute window is also the bound the cache policy has to meet: every
un-hashed object (the route documents, `sw.js`, `swagger-schema.json`) must reflect
the new build inside it, while everything under `/_next/static/` is
content-addressed and cached for a year. The classes, the `cache-control` each one
needs, and which of them the pipeline is and is not yet observed to honour are in
[`cdn-cache-strategy.md`](cdn-cache-strategy.md).

### Diagnosing a red negative-path probe

The failure line names every gap in one response, so read all of it:

- `expected 404, got 500` — the CloudFront viewer-request function is not
  associated with the distribution, or it threw. Check the function association
  before suspecting the code; `make lint-headers` and the `edge` Jest layer already
  prove the checked-in handler.
- `expected 404, got 200` — worse: the allow-list in `scripts/cloudfront_routing.js`
  has stopped fail-closing and the S3 origin is answering for unknown paths.
- `expected a non-empty 404 page` / `content-type: expected text/html` — the
  synthetic response lost its `body` or its header. Both are covered at PR time by
  the `edge` Jest layer, so a failure here means the deployed function is not the
  committed one.

Reproduce any of these locally against the same script:
`SMOKE_ATTEMPTS=1 ./scripts/ci/smoke-response-shape.sh https://vilnacrm.com`.

### How the edge functions reach CloudFront

The website pipeline deploys the **export**, not the edge functions.
`scripts/cloudfront_routing.js` is published by Terraform in the
`website-infrastructure` repository (`terraform/app/modules/aws/cloudfront/function.tf`),
which fetches it from this repository's `main` branch when the website stack is applied
against the production account. So a merged `ROUTE_MAP` change is live on the CDN only
after that apply — until then the distribution runs the previously applied function, the
new `.html` object is in the bucket, and the extensionless URL 404s. That is the exact
shape `/en` had after #470 merged: `/en.html` served, `/en` did not.

As of September 2026 that module declares **no** resource for
`scripts/cloudfront_security_headers.js`, so whether the viewer-response function is
associated at all is something only the post-deploy header probe can answer once
`PRODUCTION_SITE_URL` is set. Treat the guide's "associate both functions" as the
target state, not the observed one, until that probe is green.

To roll a routing change out:

1. Merge it to `main`; Terraform reads `main`, not a branch or tag.
2. In `website-infrastructure`, plan the website stack against production (test
   first, per that repository's README). The plan must show exactly one change —
   the `code` of `aws_cloudfront_function.routing_function`. Anything else is
   unrelated drift to understand before applying.
3. Apply. `publish = true` makes the new version live on the existing association;
   no distribution update or invalidation is required. The synthetic 404 is
   generated by the viewer-request function, before the cache, so CloudFront never
   stored it and there is nothing to invalidate — a browser may hold it for the
   sixty seconds its `cache-control` allows, no longer.
4. Fetch each changed route and expect `200`.

CloudFront rejects a function larger than 10 KB, so `make lint-prod-guardrails` holds
both files under that quota on every PR; an oversized file would fail step 3 and
leave production on the old version. The design notes for the routing function are in
[`edge-routing.md`](edge-routing.md).

### One-time setup

The smoke test needs to know the public site URL. Until it is configured the
job **skips cleanly**, so `main` stays green.

1. Add a repository **variable** named `PRODUCTION_SITE_URL` set to the site
   origin (for example `https://vilnacrm.com`) under _Settings → Secrets and
   variables → Actions → Variables_.
2. Confirm the next deploy runs the `post-deploy smoke test` job and that every
   probe above passes.

The sandbox leg is configured the same way and is likewise skipped until it is.
Add a repository variable named `SANDBOX_SITE_URL_TEMPLATE` holding the sandbox
origin with a `{pr}` placeholder — for example
`https://pr-{pr}.sandbox.example.com` — and `sandbox-creating.yml`'s
`post-create-smoke` job will run the same negative-path probe against each PR's
sandbox, plus an advisory `X-Robots-Tag: noindex` check, since a sandbox origin
must not be indexable.

`{pr}` is the only placeholder the job substitutes. The sandbox hostname is
derived from the branch name by the infra repository's CodePipeline, which this
repository triggers with the raw `BRANCH_NAME`; reconstructing that transform
here would be a guess, and a wrong guess probes an origin the sandbox is not at —
reddening a healthy PR, or certifying a different sandbox. A template containing
`{branch}` is refused with an explicit error rather than probed. If the sandbox
URL scheme is branch-derived rather than PR-derived, expose a PR-keyed alias in
the infra repository instead of adding a slug rule here.

### Environment protection rules

No sandbox job in this repository declares an `environment:` today (the `deploy`
job in `deploy.yml` does declare `environment: production`). Adding one to a
sandbox job is a **three-step sequence that must be done in order** (issue #375);
the steps below are the prerequisites, not something already delivered.

Naming an environment is not inert. It changes the OIDC subject GitHub mints for
that job from `repo:VilnaCRM-Org/website:pull_request` to
`repo:VilnaCRM-Org/website:environment:<name>`, so a role whose trust policy does
not already accept the new subject stops being assumable. PR #464 added the keys
first and every sandbox run failed at `sts:AssumeRoleWithWebIdentity`
([run 34385698159](https://github.com/VilnaCRM-Org/website/actions/runs/34385698159/job/102581269340));
the keys were reverted.

#### Step 1 — update the role trust policies (infrastructure repository)

Each privileged role's trust policy must accept the exact environment subject it
will be assumed under, with `StringEquals` and never a `StringLike` wildcard. The
role-to-subject table lives in
[`.github/sandbox_workflows.md`](../.github/sandbox_workflows.md). This is an
out-of-repo change and must land first.

#### Step 2 — create the environments (repository settings)

Create these four environments under _Settings → Environments_, one per
privileged role, so that approving a sandbox rebuild never also approves a
production deploy.

- **`production`** — for `deploy.yml` / `deploy`, which assumes
  `website-deploy-trigger-role`. Highest blast radius: it triggers the
  production CodePipeline. Required reviewer: a maintainer from the
  release/infrastructure group.
- **`sandbox`** — for `sandbox-creating.yml` / `deploy`, which assumes
  `sandbox-creation-trigger-role`. Runs in the production AWS account on every
  PR synchronize, so a reviewer here is what stops an unreviewed branch
  provisioning prod-account infrastructure. Required reviewer: a maintainer.
- **`sandbox-tokens`** — for `sandbox-creating.yml` / `check-tokens`, which
  assumes `github-actions-role` in both the test and production accounts to read
  Secrets Manager. Required reviewer: a maintainer.
- **`sandbox-teardown`** — for `sandbox-deleting.yml` /
  `trigger-sandbox-deletion-pipeline`, which assumes
  `sandbox-deletion-trigger-role`. Destructive, but only against sandbox
  resources; a wait timer is usually enough.

For each one:

- **Required reviewers** — the job waits for approval before the role is
  assumed and before CodePipeline is triggered. This is the control issue #375
  F1/F2 asks for; without it the environment is a label and nothing more.
- **Wait timer** — an optional delay before the job runs.
- **Deployment branches** — for `production`, restrict to `main`.

#### Step 3 — add the `environment:` keys to the workflows

Only after steps 1 and 2 are in place, add `environment: <name>` to the
corresponding job in `sandbox-creating.yml` and `sandbox-deleting.yml`, and
confirm the sandbox pipeline is green on a pull request before merging.

Adding a required reviewer to `sandbox` and `sandbox-tokens` means every pull
request that pushes a new commit queues for approval before its sandbox
rebuilds. That is the intended trade-off, and it is why the environments are
split: the reviewer set for a sandbox rebuild can be broader than the one for a
production deploy.

Nothing here is enforced by default. Steps 1 and 2 are configuration changes
that cannot be committed.

## Rollback procedure

Production serves whatever the pipeline last published, so rolling back means
publishing a known-good revision again.

**Find the last commit that was deployed.** `make rollback-info` (host-only;
needs an authenticated `gh` and `jq`) reads the GitHub Deployments API that the
`production` environment on `deploy.yml` populates and prints the newest
deployment whose job succeeded — commit, ref, timestamp and the run that
performed it — skipping any newer deployment whose job failed. It is the only
per-commit deploy record this repository produces, and it is read-only by
construction; its exit codes tell the cases apart (`2` no `gh`, `3` not
authenticated, `4` no successful deployment in the window, `5` API error).

Read the output honestly: "success" means the deploy **job** succeeded, that is,
the CodePipeline execution was _triggered_ (issue #329, ADR 0001). The job does
not wait for the pipeline, and the post-deploy smoke skips until
`PRODUCTION_SITE_URL` is set, so this is the last commit handed to the pipeline,
not the last commit proved live. Confirm what is actually serving with the
[manual verification](#manual-verification) commands before treating that commit
as the good one.

**Preferred — revert on `main`.** Identify the last known-good commit, revert
the offending commit(s), and push. The push re-triggers `deploy.yml`, which
redeploys the reverted state and re-runs the smoke test:

```bash
make rollback-info
git revert --no-edit <bad-commit-sha>
git push origin main
```

**Alternative — re-run the pipeline.** If the fix is not a code change (for
example a bad environment variable), re-run `ci-cd-website-prod-pipeline` from
the AWS CodePipeline console against the last successful source revision.

A rollback has not yet been exercised end to end on production; the first one
should be recorded here — date, trigger, commits, time to recovery — so the
procedure is evidence rather than intent (#329). The availability posture,
including the recovery targets a rollback has to meet, is in
[`docs/availability.md`](availability.md).

## Alerting and release audit

A failed deploy is only actionable if somebody is told. `ci-health-alerts.yml`
watches this workflow by its `name:` (`website`) through `workflow_run` and files
or refreshes a `ci-alert` tracking issue on a failed or timed-out run, closing it
on recovery. `release-audit.yml` separately records every release and every
automated push to `main`, escalating anomalies onto the same label — see
[the release audit trail](release-audit.md).

That coupling is enforced: `make lint-prod-guardrails` fails a pull request if a
privileged workflow runs on a non-pull-request trigger without being listed in
`ci-health-alerts.yml`. Privileged means it assumes an AWS role, cuts a release,
or calls a local `./.github/actions/**` composite action — the gate cannot see
inside a composite, so it assumes the worst rather than treating it as invisible.
**Renaming this workflow requires updating that list in the same commit.**

Between deploys, the scheduled synthetic check in `uptime-check.yml` watches the live
site and files an `uptime-alert` issue — see the [monitoring runbook](runbooks/monitoring.md)
and the [incident response runbook](runbooks/incident-response.md).

## Build traceability

`make build-out` writes `out/version.json` — `{"version", "commit", "builtAt"}` — so a
deployed bundle can be tied back to the commit and package version that produced it; it
is servable at `/version.json` (added to `scripts/cloudfront_routing.js`'s
`ALLOWED_FILES` for that reason). Separately,
[`.github/workflows/release-provenance.yml`](../.github/workflows/release-provenance.yml)
rebuilds `out/` on every push to `main` and attests it with
`actions/attest-build-provenance`:

```bash
gh attestation verify website-out-<sha>.tar.gz --owner VilnaCRM-Org --repo website
```

This proves GitHub Actions built that commit reproducibly — **not** that the exact bytes
CodePipeline published to `vilnacrm.com` match it, since CodePipeline builds the
production artifact independently, in AWS (see [ADR
0010](adr/0010-build-and-release-provenance.md) for the full scope and what remains
open — CodePipeline execution polling — and why).

## Manual verification

To check production by hand at any time (replace the host with the value of
`PRODUCTION_SITE_URL`):

```bash
curl -fsSI https://vilnacrm.com/ | head -n 1
curl -fsS https://vilnacrm.com/swagger | grep -i swagger
curl -fsSI https://vilnacrm.com/ | grep -Ei 'frame-options|frame-ancestors'

# The RFC 9116 policy must be published, and a path outside the edge
# allow-list must return the site 404 rather than an S3 error document.
curl -fsS https://vilnacrm.com/.well-known/security.txt | head -n 3
curl -s -o /dev/null -w '%{http_code}\n' https://vilnacrm.com/secret.json

# Ties the live site to the commit and version that built it.
curl -fsS https://vilnacrm.com/version.json
```
