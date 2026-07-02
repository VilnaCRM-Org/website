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

Because CodePipeline deploys asynchronously, each probe retries (up to roughly
ten minutes) until the CDN serves the new build or the job times out.

### One-time setup

The smoke test needs to know the public site URL. Until it is configured the
job **skips cleanly**, so `main` stays green.

1. Add a repository **variable** named `PRODUCTION_SITE_URL` set to the site
   origin (for example `https://vilnacrm.com`) under _Settings → Secrets and
   variables → Actions → Variables_.
2. Confirm the next deploy runs the `post-deploy smoke test` job and that both
   probes pass.

### Environment protection rules

`deploy.yml` references the `production` environment. To require a human
checkpoint before a production deploy, add protection rules under _Settings →
Environments → production_:

- **Required reviewers** — the deploy waits for approval before CodePipeline is
  triggered.
- **Wait timer** — an optional delay before the job runs.

No rules are enforced by default; adding them is a repo-settings change and does
not require a code change.

## Rollback procedure

Production serves whatever the pipeline last published, so rolling back means
publishing a known-good revision again.

**Preferred — revert on `main`.** Identify the last known-good commit, revert
the offending commit(s), and push. The push re-triggers `deploy.yml`, which
redeploys the reverted state and re-runs the smoke test:

```bash
git revert --no-edit <bad-commit-sha>
git push origin main
```

**Alternative — re-run the pipeline.** If the fix is not a code change (for
example a bad environment variable), re-run `ci-cd-website-prod-pipeline` from
the AWS CodePipeline console against the last successful source revision.

## Manual verification

To check production by hand at any time (replace the host with the value of
`PRODUCTION_SITE_URL`):

```bash
curl -fsSI https://vilnacrm.com/ | head -n 1
curl -fsS https://vilnacrm.com/swagger | grep -i swagger
```
