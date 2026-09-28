# Availability posture

What keeps the public website up, what can take it down, how long each failure is
allowed to last, and who owns each piece (issue #329). This is the posture the runbooks
act on; it records targets, not measurements — the site has no traffic-derived SLO yet,
and the detection window below is the honest ceiling on every recovery time.

## Topology

The site is a static export ([ADR 0001](adr/0001-static-export-s3-cloudfront.md)):

```text
push to main ──▶ deploy.yml ──▶ CodePipeline (AWS) ──▶ S3 bucket ◀── CloudFront ◀── viewer
                (triggers only)  build + publish         origin       + 2 edge functions
```

- **CloudFront** serves every request from a global edge cache in front of one S3
  origin. Two CloudFront Functions committed here run on every request:
  `scripts/cloudfront_routing.js` (route rewrites and the fail-closed allow-list that
  turns anything not exported into the synthetic 404) and
  `scripts/cloudfront_security_headers.js` (the policy in `config/security-headers.json`).
- **S3** holds exactly one export at a time. There is no origin server, no runtime, no
  database, and no session state anywhere in the serving path.
- **CodePipeline** builds the export from `main` and publishes it. `deploy.yml` only
  triggers the execution; the build and publish run asynchronously in the AWS account.
- **The sign-up form** is the one dynamic dependency: it posts to the user-service
  GraphQL endpoint (`NEXT_PUBLIC_GRAPHQL_API_URL`). Its availability is the user-service's
  posture, not this one's; the site renders fully without it.

### What lives outside this repository

- The distribution, bucket, pipeline, IAM roles and the association of the edge
  functions are Terraform in `VilnaCRM-Org/website-infrastructure`. That apply fetches
  the routing function from `main` at apply time, so a merged change to it is live only
  after an infra apply — [`docs/edge-routing.md`](edge-routing.md) records what that
  cost us once. It declares no resource for the headers function at all.
- Pipeline and build logs are in CloudWatch in the AWS account, not in GitHub — see
  [`.github/website_deployment.md`](../.github/website_deployment.md).
- Environment protection on the `production` GitHub Environment, the
  `PRODUCTION_SITE_URL` variable that arms the post-deploy smoke, and the `main` ruleset
  are repository settings; the [deployment runbook](deployment-runbook.md) lists what
  each one unblocks.

## Failure modes

Because nothing computes at request time, an outage is one of exactly three things,
plus two adjacent faults that look like one. Each entry names the check that sees it and
the runbook that handles it.

**The CDN is not serving the export** — an S3 error document, a 5xx, an expired
certificate, DNS.

- Detected by `uptime-check.yml` every 30 minutes (`/`, `/swagger` and the 404 shape),
  which files the `uptime-alert` issue.
- Recovered by an infrastructure change in `website-infrastructure`; nothing in this
  repository can restore it.

**The export is wrong** — a bad deploy broke a page, a route or a header.

- Detected by the same check for the three probed paths, by a human report for anything
  else, and by `post-deploy-smoke` once it is armed.
- Recovered by the [rollback procedure](deployment-runbook.md#rollback-procedure): a
  `git revert` on `main` re-publishes the previous state.

**The deploy that should have replaced it did not happen.**

- Detected by `ci-health-alerts.yml` on a failed `website` or release run (`ci-alert`);
  `make rollback-info` shows what was last handed to the pipeline.
- Recovered by re-running `deploy.yml`, or the pipeline from the AWS console, against the
  last successful revision.

**An edge function misbehaves.**

- Detected by `make lint-headers` and the `edge` Jest layer before merge, and by the
  negative-path probe after.
- Recovered by reverting the function; if it was never associated with the distribution,
  that is an infrastructure change.

**The sign-up mutation fails.**

- Not monitored here: the form shows its generic error and reports to Sentry once a DSN
  is set.
- Owned by the user-service; the landing stays up without it.

Both edge functions fail **open** on their own error path by design (ADR 0001): a bug
in a handler degrades to "origin behaviour, no headers", never to a site-wide 502.

## Recovery targets

- **Detection, any failure — at most 30 minutes.** The uptime check's cadence. It is the
  ceiling until the post-deploy smoke is armed, which closes the window for the "export
  is wrong" case to the deploy itself.
- **RTO, bad deploy — at most one hour from detection.** One `git revert` and one
  pipeline execution; there is no data to restore and no cache to warm. Measure the first
  real rollback and tighten this.
- **RTO, CDN or origin outage — owned by infrastructure.** Restoration is an apply in
  `website-infrastructure`; this repository can only detect it and file the issue.
- **RPO — zero.** The only state is the export, which is a pure function of `main`. Any
  commit can be re-published; nothing written at request time exists to lose.

The targets are commitments about the procedure, not measured service levels: no
error-rate or latency SLO is defined, and the synthetic check is the only availability
signal. The gaps that keep it that way — no post-deploy verification until
`PRODUCTION_SITE_URL` is set, no production error telemetry until a Sentry DSN is
committed, no way for a probe to tell an old build from a new one — are listed in the
[monitoring runbook](runbooks/monitoring.md#known-gaps).

## Redundancy

- **Serving** is redundant by the platform: CloudFront replicates the export to every
  edge and keeps serving cached objects through a short origin outage. There is no
  second origin and no failover; the S3 bucket is the single copy in the account.
- **Rebuild** is redundant by construction: every commit on `main` is a complete input to
  the pipeline, so the bucket can be repopulated from any revision without a backup.
- **Deploy path** has no redundancy — one pipeline, one role. A broken pipeline stops
  new publishes but does not affect what is already serving, which is why "the deploy did
  not happen" is a separate failure mode from the two that take the site down.

## Related

- [Deployment and rollback runbook](deployment-runbook.md) — the procedures.
- [Monitoring runbook](runbooks/monitoring.md) and
  [incident response runbook](runbooks/incident-response.md) — the alerts and the
  response.
- [ADR 0001](adr/0001-static-export-s3-cloudfront.md) — why the topology is what it is,
  and what it costs.
