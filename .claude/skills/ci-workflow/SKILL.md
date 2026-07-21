---
name: ci-workflow
description: >-
  Use when validating website changes before commit, push, or PR — picking which
  Makefile suites to run, in what order (make format, then focused tests, then make
  lint), and how to react to failures. Triggers: "ready to commit", "before PR",
  "is this CI-green", "which tests do I run", "make lint / make format failed",
  "make ci-lint", "make ci-test", and Prettier / ESLint / tsc / markdownlint /
  dependency-cruiser / Jest / Playwright / Stryker failures.
---

# CI Workflow

How to take a website change from "edited" to "ready to push" without guessing.
Every command here is a Makefile target run from the repo root (this repo has no
`package.json` scripts — the Makefile is the command surface). Pair this with the
test-coverage contract in [AGENTS.md](../../../AGENTS.md): that file decides _what_
to test; this skill decides _which suites to run and in what order_.

## Core rule: format, then test, then lint

Run the one mutating step first, then the read-only gates:

```bash
make format   # Prettier writes formatting changes — must run before lint
# focused suite(s) for the change — see "Match the change to suites"
make lint     # read-only gate: ESLint + TypeScript + markdownlint + dependency-cruiser
```

`make format` only rewrites files (Prettier). `make lint` never mutates — it fails if
anything is off. Running tests between them means you validate already-formatted code,
so a formatting rewrite can never invalidate a green test run.

Locally, prefix any unit suite with `CI=1` to run it directly (no Docker):
`CI=1 make test-unit-client`. E2E, visual, load, memory-leak, and Lighthouse suites
run against the Docker prod/Mockoon stack and are started by their own targets.

## Match the change to suites

Pick the smallest set that actually exercises the change, then always finish with
`make lint`. A single change often needs more than one suite.

- Markdown / docs only — `make lint-md` (then `make lint`). Note: `.claude/skills/**`
  is not markdownlint-scanned, but it _is_ Prettier-formatted, so still run
  `make format`.
- React component / hook / client logic — `CI=1 make test-unit-client`. Covers
  `src/features/*/components`, `src/components`, `src/hooks`,
  `src/test/testing-library`, and `src/test/unit`.
- Apollo resolver / GraphQL server-mock logic (`src/test/apollo-server`) —
  `CI=1 make test-unit-server`. Touched both layers? `CI=1 make test-unit-all`.
- User-facing flow end to end — `make test-e2e` (Playwright + Mockoon API mock).
- Rendered UI or styling — `make test-visual` (Playwright snapshots). Only for a
  deliberate, reviewed visual change, refresh baselines with `make test-visual-update`
  and inspect the diff before committing.
- Imports, feature public-API barrels, or cross-feature/shared-layer boundaries —
  `make lint-deps` (dependency-cruiser); it is already inside `make lint`.
- i18n strings (`src/features/*/i18n/{en,uk}.json`) — client unit tests that assert the
  `t()` output, plus `make test-e2e` / `make test-visual` if the string is visible.
- Makefile or CI shell scripts (`scripts/ci/*`) — `make test-bats`.
- Test strength for new/changed logic — `make test-mutation` (Stryker).
- Performance-sensitive paths — `make lighthouse-desktop` / `make lighthouse-mobile`,
  `make load-tests` (K6), `make test-memory-leak` (Memlab).

See [examples/validation-sequences.md](examples/validation-sequences.md) for copy-paste
command blocks per change kind.

## CI phase aliases

The pipeline phases are exposed as targets so you can run the exact CI stages locally:

- `make ci-lint` — grouped, parallel ESLint + TypeScript + markdownlint with aggregated
  output (mirrors the lint stage). `make lint` additionally runs `lint-deps`; run the
  full `make lint` before pushing.
- `make ci-test` — parallel dev-side tests: client unit, server unit, and integration.
- `make ci` — the whole local CI flow (setup, lint, dev tests, mutation, prod setup,
  prod tests). Heavy; use it for a final pre-PR sweep, not per-edit.

Prefer the focused suites during iteration and the `ci-*` aliases for a final check.

## Pre-commit checklist

- [ ] `make format` ran after the last edit.
- [ ] The focused suite(s) for the change ran and passed (`CI=1` locally).
- [ ] `make lint` passed (ESLint, tsc, markdownlint, dependency-cruiser).
- [ ] `git status --short` shows only intended files.
- [ ] Commit message follows Conventional Commits (per AGENTS.md).

## Pre-PR checklist

- [ ] Every applicable suite from "Match the change to suites" ran green.
- [ ] For UI/behavior changes: `make test-e2e` and/or `make test-visual` ran; any
      reviewed baseline refresh used `make test-visual-update`.
- [ ] Bug fixes include a regression test that failed before the fix (AGENTS.md Step 4).
- [ ] No gate was weakened to pass (see "Never weaken a gate").
- [ ] `make ci-lint` and `make ci-test` (or `make ci`) pass for a pipeline-faithful run.

## When a gate fails

- Formatting diff — re-run `make format`, then review the rewritten files; do not edit
  formatting by hand.
- ESLint — fix the flagged rule. Never add `eslint-disable`.
- TypeScript — fix the type contract. Never add `@ts-ignore`, `@ts-nocheck`, or
  `@ts-expect-error`.
- markdownlint — keep headings, fences, list markers, and line length compliant.
- dependency-cruiser — respect feature boundaries: import features via their `index.ts`
  barrel, keep shared layers from importing features, and avoid cross-feature deep paths.
- Jest — reproduce the one failing spec before changing code; fix behavior, not the
  assertion.
- Playwright visual — confirm whether the diff is a real, intended UI change. If so,
  refresh with `make test-visual-update`. If it is only environment drift, see
  [reference/failure-recovery.md](reference/failure-recovery.md).
- Stryker — kill survivors by adding a behavior assertion, not by deleting the mutant's
  code path.

Deeper, per-gate recovery steps live in
[reference/failure-recovery.md](reference/failure-recovery.md).

## Never weaken a gate

A passing run achieved by lowering the bar is a failing change. Do not add
`eslint-disable`, `prettier-ignore`, `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`, or
markdownlint
disable directives; do not relax dependency-cruiser rules, lower coverage or mutation
thresholds, or add `maxDiffPixels` to silence a visual diff. Complexity and metrics
budgets (owned by the complexity-management skill) follow the same no-lowering rule.
Fix the code or document a concrete `Not applicable: <reason>` per AGENTS.md instead.

## Related guides

Before applying this skill, confirm the active task against `../AI-AGENT-GUIDE.md` and
`../SKILL-DECISION-GUIDE.md` so every relevant skill is consulted.
