# Security Policy

## Supported versions

Only the currently deployed `main` branch (the production VilnaCRM website) is
supported. There are no long-term support branches; fixes ship forward on `main`.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub private vulnerability
reporting for this repository:

<https://github.com/VilnaCRM-Org/website/security/advisories/new>

Do not open public issues, pull requests, or discussions for security reports.

We aim to respond on the following timeline:

- **Acknowledgement:** within 3 business days.
- **Triage decision and severity:** within 10 business days.
- **Disclosure:** coordinated after a fix ships; we credit reporters who ask to
  be credited.

If you do not receive an acknowledgement within 3 business days, please re-send
the report to make sure it was not missed.

## Machine-readable policy

The same contacts are published as an RFC 9116 policy at
[`public/.well-known/security.txt`](public/.well-known/security.txt), served from
the static export at `/.well-known/security.txt`.

It carries a hard `Expires` date: RFC 9116 consumers ignore the policy once that
date passes, so a stale file is worse than none. `make lint-security-txt` fails
once fewer than 60 days of runway remain — while there is still time to review
and merge a refresh — and also rejects a date more than 366 days out. The weekly
`security testing` workflow re-runs the same check when no pull request is open.
Fix a failing gate by **bumping `Expires`** and re-confirming the contacts still
reach a human — never by lowering the threshold in
`scripts/ci/check-security-txt.sh`.

## Automated scanning and guardrails

- **CodeQL** runs on every pull request, every push to `main`, and weekly
  (`.github/workflows/security-testing.yml`). `scripts/ci/code-scanning-gate.sh`
  fails the run on new high/critical findings; a failed scan on `main` opens a
  `ci-alert` tracking issue with the findings attached.
- **Secret scanning** runs gitleaks over the working tree
  (`.github/workflows/secrets-scanning.yml`).
- **Production guardrails** (`make lint-prod-guardrails`) fail a pull request if
  a privileged workflow loses its alerting, if the edge routing allow-list stops
  failing closed, or if browser source maps are enabled.
- **Release audit** (`.github/workflows/release-audit.yml`) records every release
  and every automated push to `main`.

## Scope

In scope:

- The production website and its static export.
- The CloudFront edge function (`scripts/cloudfront_routing.js`), including its
  fail-closed routing allow-list — a path outside that allow-list must be
  answered with the site 404 rather than reaching the S3 origin.
- The CI/CD workflows under `.github/workflows/`.
- This repository's dependency tree.

Out of scope:

- The GraphQL user-service API, which is maintained in its own repository and
  has its own security policy.
- Denial-of-service, volumetric, or automated scanning reports without a
  demonstrated concrete impact.

## Known vulnerabilities

None currently tracked. Confirmed issues are handled through private advisories
until a fix is released.
