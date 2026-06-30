# Suite selection reference

The complete website test surface, the env each suite uses, where its specs
live, and how the suites group into CI phases. Every runner is a `make` target —
never invoke `jest`, `playwright`, `stryker`, `memlab`, or `k6` directly in
committed workflows; the targets wire env vars, Docker, and Mockoon for you.

## Unit-style suites (Jest, one install, `TEST_ENV` switch)

| Target                  | Env                                    | Specs                                                                  |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `make test-unit-client` | jsdom (`TEST_ENV=client`)              | `src/test/testing-library/**/*.test.tsx`, `src/test/unit/**/*.test.ts` |
| `make test-unit-server` | node (`TEST_ENV=server`)               | `src/test/apollo-server/**/*.test.ts`                                  |
| `make test-integration` | jsdom + Fetch (`TEST_ENV=integration`) | `tests/integration` (`api/`, `flows/`, `utils/`)                       |
| `make test-unit-all`    | both client + server                   | runs the two unit layers in sequence                                   |

- Client unit covers components, hooks, and pure client logic; it is the layer
  for React Testing Library specs and small helper units.
- Server unit covers the local Apollo Server resolvers and any node-side logic.
- Integration exercises cross-layer API/flow wiring under `tests/integration`; it
  runs in a jsdom env with the real Fetch API
  (`tests/integration/jsdom-fetch.environment.js`), not a plain node env.
- `make test-integration-watch` runs the integration layer in watch mode for
  local iteration.

Prefix any unit target with `CI=1` to run it locally WITHOUT Docker
(`CI=1 make test-unit-all`). To reproduce a single failing file, run Jest
through pnpm with the same env the target sets, for example:

```bash
CI=1 TEST_ENV=server pnpm exec jest src/test/apollo-server/server.test.ts
```

## Browser suites (Playwright, Docker prod stack)

E2E and visual specs run across chromium, firefox, and webkit against the
Docker production build the target starts.

| Target                    | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `make test-e2e`           | User-facing flows end to end with the Mockoon API mock |
| `make test-e2e-ui`        | Same flows in Playwright UI mode                       |
| `make test-visual`        | Visual regression against committed snapshots          |
| `make test-visual-ui`     | Visual suite in Playwright UI mode                     |
| `make test-visual-update` | Refresh visual baselines after a reviewed UI change    |

- E2E specs live in `src/test/e2e/**/*.spec.ts` (for example
  `src/test/e2e/register-form`, `src/test/e2e/swagger`) and drive flows against
  Mockoon fixtures.
- Visual specs live in `src/test/visual/**/*.spec.ts`; each spec keeps its
  baselines in an adjacent `<spec>.spec.ts-snapshots/` folder.
- Only run `make test-visual-update` after you have inspected the diff and
  confirmed the pixel change is intended; commit the regenerated PNGs with the
  change that caused them.

## Specialized suites

| Target                               | Tool    | Use it for                                |
| ------------------------------------ | ------- | ----------------------------------------- |
| `make test-mutation`                 | Stryker | Strength of existing assertions           |
| `make test-bats`                     | Bats    | Makefile and CI shell-flow coverage       |
| `make test-memory-leak`              | Memlab  | Memory growth across interactions         |
| `make test-load` / `make load-tests` | K6      | Homepage traffic / throughput             |
| `make test-load-swagger`             | K6      | Swagger-page load scenarios               |
| `make lighthouse-desktop`            | LHCI    | Desktop performance, a11y, best practices |
| `make lighthouse-mobile`             | LHCI    | Mobile performance and UX                 |

- `make test-mutation` builds the app first, then runs Stryker; surviving
  mutants mean a behavior is unasserted.
- `make test-memory-leak` and the load/Lighthouse targets bring up the prod
  stack; Memlab specs live under `src/test/memory-leak/tests`, K6 scripts under
  `src/test/load`.
- `make test-load` and `make test-load-swagger` are CRM-style aliases for
  `make load-tests` and `make load-tests-swagger`.

## CI-phase aliases

The `ci-*` targets group suites into the same phases the pipeline runs, so a
local check can mirror CI:

- `make ci-test` — unit client, unit server, and integration in parallel.
- `make ci-mutation` — Stryker in isolation (heavy; not parallelized).
- `make ci-test-prod` — e2e, visual, memory-leak, load, and Lighthouse against
  the prod stack, in sequence.
- `make ci` — the full local flow: setup, lint, dev tests, mutation, prod
  setup, prod tests.

`make ci-prod-setup` starts the prod container and installs Chromium + LHCI;
the individual `ci-test-e2e` / `ci-test-visual` / `ci-test-memory-leak` /
`ci-test-load` / `ci-test-lighthouse-*` targets assume it already ran.

## One change, several layers

A single change frequently spans rows. A new field on the registration form
needs client unit coverage for its validation, an e2e pass for the submit flow,
and a visual pass if the layout shifted. Pick every layer the change can reach;
see [../examples/routing-scenarios.md](../examples/routing-scenarios.md).
