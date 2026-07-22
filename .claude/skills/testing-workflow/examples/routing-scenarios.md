# Routing scenarios

Worked examples of mapping a website change to the suites and commands that
exercise it, then triaging. Each scenario assumes the coverage contract in
`AGENTS.md` (positive, negative, and edge/boundary classes for every layer you
touch).

## 1. New validation rule on the registration form

Change: add a rule to a `react-hook-form` field under
`src/features/registration/`.

- Layers: client unit for the validator and rendered error; e2e if the submit
  flow changes; visual if the error layout shifts.
- Run:

```bash
CI=1 make test-unit-client
make test-e2e
make test-visual
```

- Cover valid input, the invalid/validation-failure message, and the
  empty/missing-value case. Assert the localized `t()` message, not English.
- Triage: a failing `getByText` for the error usually means the message maps to
  a different translation key — fix the key, not the assertion.

## 2. Apollo resolver change in the local GraphQL mock

Change: edit a resolver or schema under the Apollo server layer.

- Layer: server unit (node env).
- Run:

```bash
CI=1 make test-unit-server
```

- Reproduce a single file with
  `CI=1 TEST_ENV=server pnpm exec jest src/test/apollo-server/server.test.ts`.
- If a client unit also mocks that resolver shape, update the Apollo mock so the
  two stay in sync (mock-state drift, not app logic).

## 3. Layout fix on the landing hero

Change: adjust spacing or a breakpoint in a `src/features/landing` component.

- Layers: client unit for any logic; visual regression for the rendered change.
- Run:

```bash
CI=1 make test-unit-client
make test-visual
```

- The visual suite will diff. Confirm the pixel change is the intended one, then
  refresh baselines and review the diff:

```bash
make test-visual-update
```

- Commit the regenerated snapshots with the change. Never add a per-test pixel
  threshold to absorb the diff.

## 4. E2E flow regression in the register form

Symptom: `make test-e2e` fails on the `src/test/e2e/register-form` flow.

- Reproduce locally against the Docker prod stack before assuming flake.
- Classify: a real flow regression, or a stale Mockoon fixture the flow depends
  on. Make the fixture explicit in setup if it drifted.

## 5. Surviving mutant on a helper

Symptom: `make test-mutation` reports a survivor in a small client helper.

- The behavior the mutant changed is unasserted. Add or strengthen a client unit
  assertion that fails when that behavior flips.
- Run the focused unit file first, then re-run mutation:

```bash
CI=1 make test-unit-client
make test-mutation
```

- Do not raise the allowed-survivor count or lower the mutation score.

## 6. Choosing between unit layers

Change touches both a component and the resolver it queries.

- Run both layers, or the combined target:

```bash
CI=1 make test-unit-all
```

- Keep the component assertions in the client (jsdom) layer and the resolver
  assertions in the server (node) layer; do not push server logic into a jsdom
  spec to avoid switching env.
