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

## Scope

In scope:

- The production website and its static export.
- The CloudFront edge function (`scripts/cloudfront_routing.js`).
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
