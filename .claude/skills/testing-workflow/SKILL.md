---
name: testing-workflow
description: >-
  Use when deciding which website test suite to run, picking the Jest client vs
  server vs integration env, or triaging a failing `make test-*` run — unit,
  e2e, visual, mutation, memory-leak, or load. Triggers on "which test should I
  run", "test-unit-client", "test-unit-server", "TEST_ENV", "test-e2e failing",
  "visual snapshot diff", "Stryker survivor", "Memlab", "K6 load test".
---

# Testing Workflow

Pick the right suite, run it through the matching `make` target, and triage
failures to a cause before editing. This skill orchestrates suite selection and
triage across the whole test surface; it does not teach how to write a spec —
route the actual Jest/RTL or Playwright authoring to
[../frontend-testing-workflow/SKILL.md](../frontend-testing-workflow/SKILL.md).

## When to use

- You changed code and need to know which layer(s) actually exercise it.
- A `make test-*` run failed and you need to isolate app logic vs test data vs
  mock state vs snapshot drift before touching anything.
- You need the Jest env (`client`, `server`, or `integration`) for a spec.

For per-gate fix detail (ESLint, tsc, markdownlint, dependency-cruiser,
Prettier, and the per-suite recovery steps) defer to
[../ci-workflow/reference/failure-recovery.md](../ci-workflow/reference/failure-recovery.md).
The coverage contract — scenario classes, skip justifications, regression
rule — lives in the root `agents.md`; this skill assumes it.

## Test routing

Match the change to the layer(s) it reaches. One change often needs more than
one row.

| What changed                          | Suite                      | Command                   |
| ------------------------------------- | -------------------------- | ------------------------- |
| Components, hooks, pure client logic  | Client unit (jsdom)        | `make test-unit-client`   |
| Apollo resolvers, server-side logic   | Server unit (node)         | `make test-unit-server`   |
| Both unit layers at once              | All unit                   | `make test-unit-all`      |
| Cross-layer API/flow wiring           | Integration                | `make test-integration`   |
| A user-facing flow, end to end        | E2E (Playwright + Mockoon) | `make test-e2e`           |
| Rendered UI or styling                | Visual regression          | `make test-visual`        |
| Reviewed UI change, refresh baselines | Visual snapshots           | `make test-visual-update` |
| Strength of existing assertions       | Mutation (Stryker)         | `make test-mutation`      |
| Makefile / CI shell flows             | Bats                       | `make test-bats`          |
| Memory growth across interactions     | Memory leak (Memlab)       | `make test-memory-leak`   |
| Traffic / throughput                  | Load (K6)                  | `make test-load`          |
| Performance, a11y, and best practices | Lighthouse                 | `make lighthouse-desktop` |

Second variants and the CI-phase aliases (`make ci-test`, `make ci-test-prod`,
…) are in [reference/suite-selection.md](reference/suite-selection.md).

## Jest env selection

The three unit-style suites share one Jest install and switch on `TEST_ENV`:

- `TEST_ENV=client` — jsdom env for components, hooks, and pure client logic.
  Specs: `src/test/testing-library/**/*.test.tsx` and `src/test/unit/**/*.test.ts`.
- `TEST_ENV=server` — node env for Apollo resolvers and server-side logic.
  Specs: `src/test/apollo-server/**/*.test.ts`.
- `TEST_ENV=integration` — jsdom env with the real Fetch API (via
  `tests/integration/jsdom-fetch.environment.js`) for the cross-layer integration
  suite under `tests/integration`.

Use the `make` targets above rather than setting `TEST_ENV` by hand; they wire
it for you. Unit suites run locally WITHOUT Docker when prefixed with `CI=1`
(for example `CI=1 make test-unit-client`). E2E, visual, memory-leak, load, and
Lighthouse run against the Docker prod stack the targets bring up.

## Triage

1. Re-run the smallest failing unit, e.g.
   `CI=1 TEST_ENV=client pnpm exec jest src/test/unit/email-validation.test.ts`.
2. Read the first real failure before editing anything downstream of it.
3. Classify the cause: app logic, test data (Faker builder), mock state (Mockoon
   fixture or Apollo mock), visual snapshot drift, or environment drift.
4. Fix the cause, not the symptom. For a bug fix, add the regression test that
   fails before the fix and passes after it (agents.md, Step 4).
5. Re-run the focused suite, then `make format` and `make lint`.

Per-suite classification cues (snapshot drift vs real diff, surviving mutants,
Mockoon flake) are in [reference/triage.md](reference/triage.md).

## Behavior-first

Assertions must reflect what a user perceives, not implementation details.
Query with `getByRole`, `getByLabelText`, `getByAltText`, and `getByText`; use
Playwright user-facing locators in e2e; assert localized `t()` output, not
hardcoded English. Treat snapshots and screenshots as a supplement that guards
appearance — the load-bearing assertions check behavior. The authoring patterns
live in [../frontend-testing-workflow/SKILL.md](../frontend-testing-workflow/SKILL.md).

## Verification

```bash
make format                  # Prettier (run before lint)
CI=1 make test-unit-client   # Client unit suite (jsdom, no Docker)
CI=1 make test-unit-server   # Server unit suite (node, no Docker)
make test-e2e                # User-facing flows (for behavior changes)
make test-visual             # Visual regression (for UI or styling changes)
make lint                    # ESLint + tsc + markdownlint + dependency-cruiser
```

Run only the suites the change affects, but never skip one that applies. If a
reviewed UI change makes baselines stale, regenerate with `make test-visual-update`
and review the diff before committing.

## Related guides

Confirm the task against [../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md), then route to:

- [../frontend-testing-workflow/SKILL.md](../frontend-testing-workflow/SKILL.md)
  — writing Jest/RTL and Playwright specs, fixtures, and scenario coverage.
- [../ci-workflow/SKILL.md](../ci-workflow/SKILL.md) — the full lint/test gate
  order and per-gate recovery.

## Supporting files

- [reference/suite-selection.md](reference/suite-selection.md) — full target
  surface, second variants, CI-phase aliases, and local vs Docker.
- [reference/triage.md](reference/triage.md) — failure classification and
  per-suite cues.
- [examples/routing-scenarios.md](examples/routing-scenarios.md) — worked
  change-to-suite walkthroughs.
