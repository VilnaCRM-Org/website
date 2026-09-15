# Runbooks

Operational procedures for the VilnaCRM public website: what watches production, where an
alert lands, and what to do when one does (issue #336).

- [Monitoring](monitoring.md) — every automated check that watches production or `main`,
  the issue label each one files on, what is currently inert and what unblocks it, and the
  gaps that are not covered at all.
- [Incident response](incident-response.md) — the procedure when the uptime incident issue
  opens, or a human reports the site down: confirm, classify, mitigate, verify, record.
- [Deployment and rollback](../deployment-runbook.md) — how a deploy reaches production,
  the post-deploy smoke test, and the rollback procedure. It predates this directory and
  stays where it is: `deploy.yml` and the README already point at it.
- [Release and bot-push audit trail](../release-audit.md) — the ledger of every release
  and every automated push to `main`, and what it cannot prove.

The site is a static export on S3 behind CloudFront ([ADR 0001][adr-0001]). There is no
origin server to restart, no database to fail over, and no status page. An incident is
therefore one of: the CDN is not serving the export, the export is wrong, or the deploy
that should have replaced it did not happen.

[adr-0001]: ../adr/0001-static-export-s3-cloudfront.md
