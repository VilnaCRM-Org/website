# ADR 0010: Build traceability via `out/version.json` and a provenance attestation

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** website maintainers
- **Related:** issue #325, issue #329, issue #331, ADR 0007, ADR 0009,
  `Dockerfile`, `Makefile` (`build-out`), `.github/workflows/release-provenance.yml`,
  `scripts/cloudfront_routing.js`

## Context

Issue #325 bundles ten acceptance criteria for release/deploy traceability. ADR 0009
already shipped the Sentry half (`release`/`environment` tags sourced from
`src/config/app-version.ts`) and explicitly scoped `out/version.json`, a provenance
workflow, and CodePipeline polling out as "the other half of #325". This record covers
the remainder that is safe to ship from inside this repository:

- The static export shipped no way to tell which commit produced a deployed bundle. A
  visitor's browser, an incident responder, or a future audit had no artifact to check
  the live site against `main`.
- `.dockerignore` excludes `.git` from the Docker build context (keeps the image lean,
  avoids leaking history), so the `build` stage of `Dockerfile` cannot compute its own
  commit SHA — only the host invoking `docker build` has `.git`.
- `tests/bats/makefile_targets.bats` stubs `docker` as a complete no-op (it never
  populates `./out`), while `git`, `jq` and `date` are real binaries in that sandbox.
  Any manifest-writing step that only runs _inside_ the Docker build would be
  unobservable to that test suite and untestable without a real Docker daemon.
- The real production build does not happen in this repository at all: CodePipeline
  builds and publishes the static export from AWS, as `docs/deployment-runbook.md`
  states ("CodePipeline then builds the static export and publishes it to the CDN").
  `website-infrastructure`, a separate repository, owns that pipeline definition.
- `scripts/ci/verify-edge-allowlist.mjs` proves `scripts/cloudfront_routing.js`'s
  allow-list is a superset of the real export on every PR (`build-artifact.yml`); adding
  a new root-level file to the export without adding it to `ALLOWED_FILES` fails that
  gate, since `json` is deliberately absent from `ALLOWED_EXTENSIONS`.
- Confirming the exact CodePipeline source-action name and whether the deploy role's IAM
  policy grants `codepipeline:GetPipelineExecution` (as opposed to only the documented
  `GetPipelineState`) both require access to the `website-infrastructure` repository or
  the AWS console, neither of which is reachable from here. A wrong guess would silently
  break the next production deploy.

## Decision

We add a build manifest to the static export and a same-commit provenance attestation in
GitHub Actions, and leave the CodePipeline-polling half of #325 open.

- **`out/version.json`.** The `build-out` Makefile target passes
  `--build-arg COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo unknown)` to
  `docker build` (the `Dockerfile` `build` stage declares `ARG COMMIT_SHA=unknown`, so a
  bare `docker build` with no build-arg still succeeds), then, on the host, after
  `docker cp` and `mkdir -p ./out`, writes
  `{"version": <package.json version>, "commit": <the same commit>, "builtAt": <UTC
ISO-8601 timestamp>}` with `jq -cn`. The manifest is generated on the host rather than
  baked into the image during the Docker build, specifically so
  `tests/bats/makefile_targets.bats` can assert its real content — including the
  git-absent `"unknown"` fallback — without a Docker daemon. The Docker `ARG`/`ENV`
  therefore threads the commit into the image build (available for image introspection,
  and the single place `.dockerignore`'s exclusion of `.git` is worked around) without
  being the sole place the value is recorded.
- **`/version.json` is servable.** It is added to `scripts/cloudfront_routing.js`'s
  `ALLOWED_FILES` as an exact match (the same pattern `/swagger-schema.json` already
  uses), so the file the edge allow-list guards is the one the export now really ships,
  and `src/test/edge/cloudfront-routing.test.ts` pins it. A deployed site therefore
  answers `GET /version.json` with the commit that produced it.
- **`.github/workflows/release-provenance.yml`.** On every push to `main`: checkout,
  `make build-out`, `tar` the resulting `out/` into one
  `website-out-<sha>.tar.gz` archive (attestation is conventionally taken against one
  release artifact, not hundreds of loose static-export files), upload it, then
  `actions/attest-build-provenance` over that archive. Every `uses:` is pinned by full
  SHA with the tag it resolves to in a trailing comment; the job's `permissions:` are
  scoped to itself (workflow-level `permissions: {}`); the commit SHA reaches the `tar`
  step through `env:`, never interpolated into the `run:` body. It is not a "privileged"
  workflow under `scripts/ci/lint-prod-guardrails.mjs` assertion A — it assumes no AWS
  role, calls no local composite action, and cuts no GitHub release — so it needs no
  entry in `ci-health-alerts.yml`.
- **Scope of the attestation.** `actions/attest-build-provenance` proves GitHub Actions
  built `out/` reproducibly from a specific commit — it says nothing about whether that
  exact archive is what CodePipeline published, because the artifact CodePipeline builds
  and serves is built separately, in AWS, from the same commit. `gh attestation verify
website-out-<sha>.tar.gz --owner VilnaCRM-Org --repo website` answers "did GitHub
  Actions build this commit", not "is this what vilnacrm.com is serving right now" — the
  second question needs the CodePipeline-execution half below, plus the existing
  post-deploy smoke test (`make smoke-prod`, issue #331) that already checks the live
  site's negative-path response shape.
- **CodePipeline polling stays out of scope here.** #325 and #329 both ask
  `deploy.yml` to wait for the CodePipeline execution result and fail the job if the
  pipeline itself fails (today it only checks that the trigger call succeeded). Writing
  that against a wrong `--source-revisions actionName=...` value, or against an IAM
  action the deploy role does not actually hold, would fail closed only after the first
  live production push past this change — invisibly to every gate in this repository.
  Confirming the pipeline's real source-action name and its role's granted
  `codepipeline:*` actions is `website-infrastructure` / AWS-console work this record
  defers rather than guesses at.

## Consequences

### What this buys

A deployed page can now be tied back to the exact commit and package version that built
it by requesting `/version.json`, without needing AWS or GitHub access. Every push to
`main` leaves a verifiable, SHA-pinned, non-repudiable record — "GitHub Actions built
commit `<sha>` into this archive" — that an auditor or incident responder can check
independently of the deploy pipeline succeeding or failing.

### What this costs

Two build-metadata mechanisms now exist side by side for different purposes:
`src/config/app-version.ts` (ADR 0009, bundled into the client JS for Sentry tagging,
package-version only) and `out/version.json` (a static file at the export root, carrying
the commit, the version and the build time, read by nothing at runtime). A future reader
has to know they answer different questions rather than assume one supersedes the other.
`release-provenance.yml` adds a second full `make build-out` per push to `main`
(deploy.yml does not build; CodePipeline does), which is 15-20 minutes of CI time and one
more Docker build to keep green. The attestation is scoped, not comprehensive: it says
nothing about whether the artifact CodePipeline actually published matches the one
GitHub Actions attested, because those are two independent builds of the same commit,
not one build
attested twice. Deploy-time traceability — "did the currently-live site come from a
pipeline run that succeeded" — remains unimplemented; `deploy.yml`'s `Trigger CodePipeline`
step still only checks that the trigger call itself succeeded, not the pipeline's outcome.

### What would reverse it

Confirmation from `website-infrastructure` of the pipeline's real source-action name and
the deploy role's granted `codepipeline:*` actions would unblock writing the polling step
this record defers, closing the remaining gap. If CodePipeline's own build were ever
changed to consume this repository's GitHub-Actions-built archive directly (rather than
rebuilding independently), the "two independent builds" caveat above would no longer hold
and the attestation could be upgraded to cover the literal deployed bytes.
