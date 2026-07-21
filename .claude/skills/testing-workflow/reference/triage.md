# Triage reference

How to turn a red suite into a known cause before editing code. The goal is
always to fix the cause, not silence the symptom — never loosen a threshold,
add `maxDiffPixels`, or suppress a gate. Per-gate fix steps for the lint surface
(ESLint, tsc, markdownlint, dependency-cruiser, Prettier) live in
[../../ci-workflow/reference/failure-recovery.md](../../ci-workflow/reference/failure-recovery.md);
this file covers the test suites.

## Triage loop

1. Shrink the blast radius. Re-run only the failing file, e.g.
   `CI=1 TEST_ENV=client pnpm exec jest src/test/unit/email-validation.test.ts`,
   so you read one failure, not fifty.
2. Read the first real failure. Later failures are often fallout from the first.
3. Classify the cause (next section) before changing anything.
4. Fix the cause. If it is a bug, add a regression test that fails before the
   fix and passes after it (AGENTS.md, Step 4).
5. Re-run the focused suite, then `make format` and `make lint`.

## Classify the cause

- App logic — the assertion is right and the code is wrong. Fix the code.
- Test data — a Faker builder produced a value the assertion did not expect.
  Faker builders are seeded for reproducibility; align the expectation or the
  builder, not both blindly.
- Mock state — an E2E flow depends on a Mockoon fixture, or a client/server unit
  depends on an Apollo mock that no longer matches the resolver shape. Make the
  mock explicit in the test setup.
- Snapshot drift — a visual or inline snapshot differs. Decide whether the diff
  is an intended UI change before regenerating (see below).
- Environment drift — a tooling bump (Playwright, browser) nudged baselines with
  no UI change.

## Per-suite cues

### Client / server unit (Jest)

- Reproduce the single file with the matching `TEST_ENV` before editing.
- A failing assertion on `getByRole` / `getByText` usually means the rendered
  output changed; confirm against the component, not by relaxing the query.
- Assert localized `t()` output — a diff between `t('...')` and hardcoded
  English is a test bug, not an app bug.

### Integration (`make test-integration`)

- Failures here are cross-layer wiring (API + flow). Confirm the contract
  between the pieces under `tests/integration` before assuming either side.

### Visual (`make test-visual`)

- First decide: is the pixel diff a real, intended UI change? If yes, refresh
  baselines with `make test-visual-update` and review the diff before
  committing.
- If it is pure environment drift (a Playwright or browser bump nudges webkit
  baselines a couple of pixels with no UI change), regenerate the affected
  baselines rather than masking it. Never add `maxDiffPixels` or a per-test
  threshold to hide a diff.

### E2E (`make test-e2e`)

- Runs against the Docker prod stack with the Mockoon API mock. A failure is
  usually a real flow regression or a stale Mockoon fixture — reproduce locally
  before assuming flake.

### Mutation (`make test-mutation`)

- A surviving mutant means a behavior is unasserted. Add or strengthen an
  assertion that fails when the mutant changes behavior. Do not raise the
  allowed-survivor count or lower the mutation-score threshold.

### Memory leak / load / Lighthouse

- These run against the prod stack. A regression points at retained references
  (Memlab), a throughput or latency budget (K6), or a performance/a11y budget
  (Lighthouse) — treat the budget as the contract and fix the cause.

## When a class genuinely does not apply

Record it with a concrete `Not applicable: <reason>` per AGENTS.md (in the test
file, the PR description, or the task summary). A bare "not applicable" or a
silent omission does not satisfy the coverage policy.
