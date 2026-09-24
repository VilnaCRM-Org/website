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
- **Secret scanning** runs the digest-pinned gitleaks image against the
  committed `.gitleaks.toml` (`.github/workflows/secrets-scanning.yml`, issue
  #353) in two legs. The `gitleaks` check scans the working tree on every pull
  request and every push to `main` (`make lint-secrets`). The history leg
  (`make scan-secrets-history`) walks every reachable commit weekly and on
  `workflow_dispatch` — it is kept off pull requests because a credential in an
  old commit is not the author's regression — and a failure opens a `ci-alert`
  tracking issue through `.github/workflows/ci-health-alerts.yml`.
- **Job-log secret scanning** (`.github/workflows/job-log-secrets-scan.yml`,
  issue #375) runs the same image and config over the downloaded logs of every
  completed run of the deploy, release and sandbox workflows
  (`make scan-secrets-logs`). A token those workflows fetch at run time is never
  a registered secret, so GitHub does not mask it; this is the scan that would
  notice one printed into a log. A finding opens a `ci-alert` issue the same
  way.
- **Push protection** is a repository setting that no commit can switch on, and
  it is not yet confirmed enabled: turning it on is an admin action tracked in
  #353, with the steps and the proof in
  [CONTRIBUTING.md](CONTRIBUTING.md#secret-scanning-push-protection-issue-353).
  Until it is, a credential is caught by the scans above after it is pushed,
  not refused at push time.
- **Dependency CVEs (osv-scanner)** are the repository's software-composition
  analysis stream (`.github/workflows/osv-scanner.yml`, issue #356). The
  `dependency cve gate` check runs `make lint-vulns` on every pull request targeting
  `main` and is **differential**: it fails only on advisories the pull request
  introduces, never on the pre-existing backlog. The `nightly dependency cve census` job scans the
  whole `bun.lock` and refreshes one `dependency CVE census` issue (label
  `dependency-cve`) with everything currently known. This is the stream that
  works here by construction: GitHub ships no Dependabot security updates for
  the `bun` ecosystem and its dependency graph does not parse `bun.lock`, so
  Dependabot alerts see none of the resolved tree — `.github/dependabot.yml`
  records the evidence, and
  [docs/swagger-highlighter-surface.md](docs/swagger-highlighter-surface.md)
  walks the one runtime tree that blindness matters most for.
- **Production guardrails** (`make lint-prod-guardrails`) fail a pull request if
  a privileged workflow loses its alerting, if the edge routing allow-list stops
  failing closed, or if browser source maps are enabled.
- **Release audit** (`.github/workflows/release-audit.yml`) records every release
  and every automated push to `main`.

## Dependency triage timeline

Repository policy for the automated dependency stream above, set to the same
clock as the private-report timeline so one calendar governs both:

- **Census issue** (`dependency CVE census`): a refresh that adds an advisory is
  read within 3 business days, and each new advisory carries a recorded decision
  within 10 business days — upgrade, replace, or a note on the census issue
  saying why the vulnerable path is unreachable here and what unblocks the real
  fix. The ignore list in `config/osv-scanner.toml` is not a census tool: it
  exists only for an advisory a pull request would legitimately introduce, and
  every entry there needs a reason and a re-triage date. An advisory whose
  vulnerable package ships in the static export (the client bundle, not a
  build-time tool) is triaged first.
- **Dependency pull requests** (Dependabot's grouped and individual version
  updates, and manual bumps): merged, split, or closed with a reason within 10
  business days of opening. A red batch is split, not left to age — one
  incompatible bump must not hold the others hostage.
- **A pull request red on `dependency cve gate`** is not merged. The advisory it
  introduces is resolved before merge, or the ignore is reviewed and landed on
  `main` first (the gate reads the base branch's ignore list, so an ignore
  cannot ship in the same change as the dependency it excuses).

## Scope

In scope:

- The production website and its static export.
- The CloudFront edge functions (`scripts/cloudfront_routing.js` for routing and
  `scripts/cloudfront_security_headers.js` for the security-header policy in
  `config/security-headers.json` — see
  [docs/security-headers.md](docs/security-headers.md)), including the routing
  handler's fail-closed allow-list — a path outside that allow-list must be
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
