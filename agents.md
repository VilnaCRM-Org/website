# agents.md

This file is the contract for AI coding agents (Claude Code, Codex, GitHub Copilot,
Cursor, and any other assistant) working in the VilnaCRM website repository. It defines a
mandatory test-coverage policy and the exact workflow to follow whenever you write or
update tests.

The stack is Next.js 16, React 19, TypeScript 6, MUI 9 with Emotion, Apollo Client 4 with
Apollo Server 5, react-hook-form, i18next, and Storybook 10. The package manager is
`pnpm@10.6.5` and Node `>=20`. The project structure is adapted from bulletproof-react. All
commands are Makefile targets run from the repository root.

## Mandatory Test-Scenario Coverage Policy

This policy is a hard requirement, not advice. It applies to every AI agent whenever you
write or update tests — when adding a feature, changing behavior, or fixing a bug. Adding
only a happy-path test is NOT adequate coverage and does NOT make the work done.

Follow the five steps below in order. Skipping a scenario class or step is allowed ONLY
with a recorded, concrete justification (see Step 3) — never by silent omission.

### Step 1 — Pick the Right Test Layer

Choose the layer(s) that actually exercise the change; a single change often needs more
than one. Match the change to the suite and run its verification command.

| Test layer        | Use it for                                 | Command                 |
| ----------------- | ------------------------------------------ | ----------------------- |
| Client unit       | Components, hooks, and pure client logic   | `make test-unit-client` |
| Server unit       | Apollo resolvers and server-side logic     | `make test-unit-server` |
| Edge unit         | Deployed edge/runtime scripts (`scripts/`) | `make test-unit-edge`   |
| End-to-end (e2e)  | User-facing flows end to end (Mockoon API) | `make test-e2e`         |
| Visual regression | Any change to rendered UI or styling       | `make test-visual`      |

Client unit tests run on Jest with React Testing Library in a jsdom env
(`TEST_ENV=client`); specs live in `src/test/testing-library/**/*.test.tsx` and
`src/test/unit/**/*.test.ts`. Server unit tests run on Jest in a node env
(`TEST_ENV=server`); specs live in `src/test/apollo-server/**/*.test.ts`. Edge unit tests
run on Jest in a node env (`TEST_ENV=edge`) and cover the deployed edge/runtime scripts
under `scripts/` that ship outside the Next.js bundle (today the CloudFront Functions
handler `scripts/cloudfront_routing.js`); specs live in `src/test/edge/**/*.test.ts` and
the layer is pinned at 100% per-file coverage. E2E and visual specs are Playwright across
chromium, firefox, and webkit (`src/test/e2e/**/*.spec.ts`, `src/test/visual/**/*.spec.ts`);
visual snapshots sit in adjacent `*-snapshots/` folders. Run all three unit layers with
`make test-unit-all`.

Add a specialized suite when the change touches its concern: `make test-mutation` (test
strength), `make test-bats` (Makefile and CI shell flows), `make test-memory-leak` (leaks),
`make load-tests` (traffic, K6), and `make lighthouse-desktop` / `make lighthouse-mobile`
(performance, accessibility, best practices).

In CI these suites are fanned out to run in parallel (issue #316): every workflow declares a
`concurrency` group (PR checks cancel superseded runs; deploy/release/sandbox do not),
the Playwright e2e suite, Lighthouse, and the K6 load suites run as matrices, and mutation
testing runs as a shard matrix whose `merge` job re-enforces the **exact** Stryker `break`
threshold over the union of shards (`make merge-mutation-reports`). The thresholds and the
test set are unchanged — locally you still run the single `make test-e2e` / `make
test-mutation`.

### Step 2 — Cover Every Applicable Scenario Class

For each layer you touch, cover all three scenario classes that apply to the change.
Positive coverage on its own is never enough.

1. Positive / happy path — valid input and expected success behavior.
2. Negative / invalid / failure path — invalid input, validation failures, and error,
   loading, timeout, and retry handling.
3. Boundary / edge cases — empty, null, and missing-data states, plus boundary values and
   off-by-one behavior.

Walk this checklist and add coverage for every item the change can reach.

- [ ] Valid input and expected success behavior
- [ ] Invalid input and validation failures
- [ ] Empty, null, or missing data states
- [ ] Loading, retry, timeout, and error states
- [ ] Permission, auth, and role-based behavior
- [ ] Boundary values and off-by-one conditions
- [ ] Locale, formatting, and translation-sensitive behavior
- [ ] Responsive and mobile differences for user-facing flows
- [ ] Accessibility-visible behavior when UI interactions change
- [ ] Regression protection for previously fixed bugs (see Step 4)

Existing suites already model this: validation suites such as
`src/test/unit/email-validation.test.ts` cover valid, invalid, and empty-string cases in
one place. Match that depth.

### Step 3 — Document Any Skipped Scenario Class

If a scenario class or checklist item genuinely does not apply, record it explicitly with a
concrete reason — in the test file (as a comment), the pull request description, or your
task summary. Use the `Not applicable: <reason>` convention. A bare "not applicable" with
no reason, or silent omission, does not satisfy this policy.

Examples of acceptable justifications:

- `Boundary / edge — Not applicable: presentational component with no inputs or branches.`
- `Permission / auth — Not applicable: static marketing footer, no authenticated state.`
- `Loading / error — Not applicable: pure synchronous helper with no async boundary.`

### Step 4 — Regression Coverage Is Mandatory for Bug Fixes

When you fix a bug, add a regression test that fails before your fix and passes after it.
This is mandatory unless there is a concrete, recorded reason a test cannot reasonably be
added (for example, the defect lives in third-party infrastructure you do not control).
Document that reason as in Step 3, and cover the previously broken scenario in the layer
that best reproduces it (usually client or server unit, sometimes e2e or visual).

### Step 5 — Verify Before Calling Test Work Done

Test work is not done until the relevant verification commands have actually been run and
pass. Run the layer commands you touched, then the project lint gate.

```bash
make format                  # Prettier formatting (run before lint)
CI=1 make test-unit-client   # Client unit suite (jsdom)
CI=1 make test-unit-server   # Server unit suite (node)
make test-e2e                # User-facing flows (for UI or behavior changes)
make test-visual             # Visual regression (for UI or styling changes)
make lint                    # Full gate: ESLint, TypeScript, and markdownlint
make lint-contracts          # Upstream contracts (when .env pins or gql documents change)
```

Run only the suites the change affects, but never skip a suite that does apply. Any unit
command runs locally WITHOUT Docker when prefixed with `CI=1` (for example,
`CI=1 make test-unit-all`). If a deliberate, reviewed UI change makes visual baselines
stale, regenerate them with `make test-visual-update` and review the diff before committing.

## Behavior-First Assertions

Prefer meaningful behavior assertions over shallow rendering or snapshot-only coverage.

- Query the way a user perceives the UI: `getByRole`, `getByLabelText`, `getByAltText`, and
  `getByText` rather than implementation details. Use Playwright user-facing locators in
  e2e specs for the same reason.
- Assert against localized strings produced by the i18next `t()` function, not hardcoded
  English, so translation-sensitive behavior stays covered.
- Use `describe` and `it` blocks, mirroring the existing suites.
- Treat snapshots and screenshots as a supplement that guards appearance; the load-bearing
  assertions must check behavior.

## Definition of Done

A change to tests is done only when every statement below is true.

- The relevant layer(s) were identified before writing tests (Step 1).
- Positive, negative, and edge/boundary cases are present for every applicable class.
- Every skipped scenario class has a concrete `Not applicable: <reason>` justification.
- Bug fixes include a regression test that fails before the fix and passes after it.
- Assertions check user-facing behavior, not implementation details or snapshots alone.
- Localized text and accessibility-visible behavior are asserted where the UI changed.
- The relevant test commands above were run and passed, including `make lint`.
- Commits follow Conventional Commits.
