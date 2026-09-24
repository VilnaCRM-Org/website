# Incident response runbook

What to do when the production website is down or wrong (issue #336). The trigger is
usually an issue on the `uptime-alert` label titled
`Uptime: the production site is failing its synthetic check`, filed by
[`uptime-check.yml`](../../.github/workflows/uptime-check.yml); it can also be a human
report. The procedure is the same either way: confirm, classify, mitigate, verify, record.

There is no status page and no pager. The incident issue is the single record of the
incident and the only place to communicate about it — keep every finding and every
action there, as comments, as you go.

## 1. Confirm from a second vantage point

The uptime check runs on one GitHub-hosted runner. Before touching anything, reproduce
from a network that is not GitHub's — a laptop on a different connection, or a phone on
mobile data:

```bash
curl -sSI --max-time 15 https://vilnacrm.com/ | head -n 5
curl -sSI --max-time 15 https://vilnacrm.com/swagger | head -n 5
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://vilnacrm.com/no-such-path
```

Then run the same scripts the workflow runs, with the retry collapsed, so the failure line
you read is the one the issue was filed on:

```bash
UPTIME_ATTEMPTS=1 ./scripts/ci/uptime-check.sh https://vilnacrm.com
SMOKE_ATTEMPTS=1 ./scripts/ci/smoke-response-shape.sh https://vilnacrm.com
```

If both pass from the second network and the workflow is still red, suspect the runner's
egress or a regional CDN edge rather than the site. Re-run the workflow from the Actions
tab (`uptime check` → _Run workflow_); a green run closes the issue by itself.

## 2. Classify by the failure line

Each script reports every gap in one line. Read all of it — the combination is the
diagnosis.

- **`expected 200, got 000` on every path** — no HTTP answer at all: DNS, TLS, or the
  distribution itself. Check the domain resolves and the certificate is valid
  (`curl -vI` shows both) before looking at anything inside AWS.
- **`expected 200, got 5xx`** — CloudFront could not get an answer from the origin, or
  a viewer function threw. This is the shape of the #226/#229 incidents.
- **`expected 200, got 403` or `404` on `/` or `/swagger`** — the distribution is
  serving, but the object is not in the bucket it points at: an incomplete or wrong
  publish, or the allow-list in `scripts/cloudfront_routing.js` rejecting a document it
  should pass. Check what the last deploy published (step 3).
- **`content-type: expected text/html, got 'application/xml'` with a `200`** — an S3
  error document is being served as the page: the origin is answering but not with the
  export.
- **`expected a non-empty page`** — the object exists and is empty, or a synthetic
  response lost its body (#249).
- **`body: expected a match for /…/i`** — the path answered `200` HTML that is not its
  own document: `/swagger` rewritten to the homepage `index.html`, or a parked or
  placeholder page in front of the site. Check the routing function's `ROUTE_MAP` and
  what the last deploy published.
- **`::warning::… is not the branded 404`** — the 404 is well-formed but not the edge
  document; it files no incident. Read
  [Diagnosing a red negative-path probe](../deployment-runbook.md#diagnosing-a-red-negative-path-probe)
  (`expected the branded 404` there has the same causes).
- **Only the negative path failing** — the site is up but the 404 contract is broken:
  the routing function is unassociated or has regressed. Read
  [Diagnosing a red negative-path probe](../deployment-runbook.md#diagnosing-a-red-negative-path-probe);
  the same lines apply here.

## 3. Check what changed

Production changes in exactly one way: a push to `main` triggers
[`deploy.yml`](../../.github/workflows/deploy.yml), which starts the
`ci-cd-website-prod-pipeline` CodePipeline; the pipeline builds the export and publishes
it to S3 asynchronously.

- **The last deploy.** Open the most recent `website` run in the Actions tab. Its
  `post-deploy smoke test` job is currently skipped on every run (see the
  [monitoring runbook](monitoring.md#the-post-deploy-smoke-test-wired-currently-skipped)),
  so a green `website` run only proves the pipeline was **triggered**.
- **The ledger.** The `Release and bot-push audit log` issue (label `release-audit`)
  records every push to `main` with its commit, author and actor — the fastest way to
  see whether anything landed since the site was last known good, and whether it was a
  human or the release bot.
- **The pipeline and the edge.** The CodePipeline execution history, the S3 bucket
  contents, the CloudFront distribution status and its function associations all live in
  the AWS account, managed from the infrastructure repository, not from here. Somebody
  with access to that account checks: did the last execution succeed; does the bucket
  hold the objects the export should contain (`index.html`, `swagger.html`, `_next/`);
  are `cloudfront_routing.js` and `cloudfront_security_headers.js` still associated with
  the default cache behaviour ([security headers](../security-headers.md) lists the
  expected association); and is the distribution enabled and deployed. CloudWatch holds
  the pipeline logs — see
  [Monitoring and Logging Recommendations](../../.github/website_deployment.md#monitoring-and-logging-recommendations).

## 4. Mitigate

Pick the smallest action that restores service; diagnosis can continue afterwards.

- **A bad deploy** (the site broke after the last push to `main`) — roll back by
  reverting on `main`, which redeploys the previous state through the normal pipeline.
  `make rollback-info` prints the last commit the pipeline was handed. The exact
  commands and the alternative of re-running the pipeline against the last good
  revision are in the
  [rollback procedure](../deployment-runbook.md#rollback-procedure).
- **A failed or partial publish** (nothing changed in this repository) — re-run the
  pipeline from the AWS console against the last successful source revision, per the same
  section.
- **An edge-function fault** — the functions are committed here, so a regression is a code
  change to revert; an unassociated function is an infrastructure change to restore.
  `make lint-headers` and the `edge` Jest layer prove the committed functions on every
  pull request, so if the deployed behaviour differs from the committed one, the
  association is the suspect.
- **Anything in the AWS account** — escalate to whoever holds access to the
  infrastructure repository. Post what you found, with the exact failure lines, on the
  incident issue.

Do not "fix" an outage by widening the allow-list in `scripts/cloudfront_routing.js`,
loosening a smoke assertion, or lengthening a retry budget. Every assertion the
negative-path script makes maps to a past incident, and a check that has been taught to
accept the failure detects nothing next time.

## 5. Verify

Re-run the two scripts from step 1, then trigger the workflow by hand
(`uptime check` → _Run workflow_). The workflow closes the incident issue itself on the
first run where both probes pass, with a `Recovered` comment linking the run. Do not
close it by hand while the check is still red: the workflow only ever looks at **open**
issues, so the next red run would file a second one and the history would split.

If `PRODUCTION_SITE_URL` has been set since, the next push to `main` also runs the
post-deploy smoke, which is the same three checks plus the security-header policy.

## 6. Record and follow up

Before the issue closes, add a final comment with: when it started and ended (the first
red run and the recovery run), what the cause was, what action restored service, and
what would have detected it sooner. Then:

- If the cause was a **new failure shape** the scripts did not distinguish, add it: the
  incident list at the top of `scripts/ci/smoke-response-shape.sh` and the cases in
  `tests/bats/smoke_response_shape.bats` and `tests/bats/uptime_check.bats` are where past
  incidents are kept from recurring unseen.
- If the cause was in the **infrastructure**, file the follow-up in that repository and
  link it from the incident issue.
- If the cause was a **deploy this repository made**, the reverted commit is the fix; open
  the pull request that re-lands it correctly and reference the incident issue.

## Escalation

There is no on-call rota. The maintainers named in
[`.github/CODEOWNERS`](../../.github/CODEOWNERS) own the workflows and the edge functions;
AWS-account access is held by the infrastructure maintainers. Security-relevant findings
follow [`SECURITY.md`](../../SECURITY.md) rather than the public incident issue.
