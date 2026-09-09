# ADR 0003: One workflow per PR check, running in parallel

- **Status:** Accepted
- **Date:** 2026-09-09 (backfilled; delivered under issue #316)
- **Deciders:** website maintainers
- **Related:** issue #316, ADR 0002

## Context

This repository gates a PR on an unusually wide surface: ESLint, TypeScript,
markdownlint, dependency-cruiser, three Jest environments, integration and contract
layers, Playwright e2e across four projects, visual regression, accessibility, mutation
testing, memory-leak detection, K6 load tests, Lighthouse, Bats, and a set of security
and policy gates. Run as one sequential pipeline, the wall-clock cost of a PR was the
**sum** of all of them.

The usual answer — tiering checks, running the expensive ones only nightly or only on
labelled PRs — trades feedback for latency and was rejected: a gate that does not run on
a PR does not protect the PR.

## Decision

Each check is its own workflow on its own runner, so a PR is gated by the slowest single
job rather than by their sum. The layout is orchestration-only: every check still runs on
every PR, at the same thresholds. Nothing is tiered off, weakened, or removed.

- Every workflow sets a `concurrency` group keyed on the PR or ref. PR checks use
  `cancel-in-progress: true`; the deploy, release, and sandbox workflows use `false`, so
  a production trigger is never aborted mid-run.
- The long suites are split by matrix: Playwright e2e across a `--shard` matrix covering
  all four projects (including the `mobile-chrome` emulation lane), Lighthouse as
  desktop/mobile, the K6 suites in parallel, and mutation testing as a shard matrix plus
  a merge gate that re-enforces the scope's `break`
  (`scripts/ci/merge-mutation-reports.ts`).
- Shared setup is factored into the `dev-container` composite action (see ADR 0002)
  rather than copied per workflow.

## Consequences

### What this buys

Full-surface gating at roughly the cost of the single slowest job, and a failure that
names itself — a red check is one workflow with one subject, not a step buried in a
monolith. Cancel-in-progress means a superseded push stops burning runner minutes.

### What this costs

- **Duplication across workflow files.** Checkout, container bring-up, concurrency, and
  permissions are repeated in every file. Renaming a workflow is load-bearing: a
  privileged workflow's `name:` must match `ci-health-alerts.yml`'s `workflow_run` list,
  and `make lint-prod-guardrails` fails the PR when it does not.
- **Runner cost and contention.** Many parallel jobs mean many concurrent runners and one
  shared BuildKit cache under a single 10 GB quota — hence the constraint that only the
  default branch writes it, since a cache written on a PR branch is readable by that PR
  alone.
- **A large required-check list.** Branch protection has to name each check individually,
  and that list is a repository setting that cannot be committed from a PR.
- **Sharded gates can lie if the split is wrong.** A mutation shard writes a partial
  report with `break` disabled, so the merge job is the only thing that enforces the
  threshold; it must fail closed, and the split must be a total partition, or the merged
  score stops equalling an unsharded run.

### What would reverse it

A runner budget that no longer supports the fan-out, or a CI platform with real
job-level caching and dependency graphs that makes a single orchestrated pipeline as fast
as the fan-out is today.
