---
name: frontend-testing-workflow
description: >-
  Use when writing, fixing, or running tests in the website repo — Jest unit
  tests (React Testing Library in jsdom, TEST_ENV=client; Apollo Server in node,
  TEST_ENV=server), Playwright e2e specs (Mockoon-backed), or Playwright visual
  regression snapshots. Triggers: make test-unit-client, make test-unit-server,
  make test-e2e, make test-visual, src/test/testing-library, src/test/unit,
  src/test/apollo-server, src/test/e2e, src/test/visual, *-snapshots, faker
  builders, getByRole, toHaveScreenshot, MockedProvider.
---

# Frontend Testing Workflow

How to pick the right test layer, run it through the Makefile, and write
behavior-first assertions for the VilnaCRM website (Next.js 16 pages router,
React 19, MUI 9, Apollo Client 4 + Apollo Server 5, react-hook-form, i18next).

## Coverage policy lives in agents.md

The mandatory scenario-coverage policy (pick the layer, cover positive /
negative / boundary classes, document skipped classes, add a regression test for
every bug fix, verify before done) is defined in the repo root
[agents.md](../../../agents.md). This skill is the _how_; agents.md is the
_contract_. Do not restate or weaken it — defer to it for what "covered" means.

## Test topology

Specs live under `src/test/`, selected by the `TEST_ENV` env var and the
Makefile target:

```text
src/test/testing-library/**/*.test.tsx   client unit  (jsdom, RTL)   TEST_ENV=client
src/test/unit/**/*.test.ts               client+server unit (shared) both envs
src/test/apollo-server/**/*.test.ts      server unit  (node)         TEST_ENV=server
src/test/e2e/**/*.spec.ts                Playwright e2e (Mockoon)    make test-e2e
src/test/visual/**/*.spec.ts             Playwright visual           make test-visual
src/test/visual/**/*-snapshots/          committed screenshot baselines
```

`src/test/unit/**/*.test.ts` is shared: it runs under both `client` and `server`
envs, so keep those specs environment-agnostic (pure logic, no jsdom or node-only
globals). See [reference/jest-environments.md](reference/jest-environments.md).

## Choose the layer

A single change often needs more than one layer. Match the change to the suite:

- Component render, hook, or pure client logic -> client unit
  (`src/test/testing-library` or `src/test/unit`).
- Apollo schema, resolver, or local GraphQL behavior -> server unit
  (`src/test/apollo-server`).
- A user-facing flow end to end -> e2e (`src/test/e2e`, Mockoon API).
- Any change to rendered UI or styling -> visual regression
  (`src/test/visual`).

## Client unit tests (jsdom, RTL)

- Run with `make test-unit-client` (Jest, Next.js jsdom env, `TEST_ENV=client`).
- Render with React Testing Library; assert through the public UI. For Apollo
  data use `renderWithProviders` from `src/test/testing-library/utils.tsx`, which
  wraps `MockedProvider` — pass `apolloMocks` rather than mocking Apollo modules.
- Query the way a user perceives the UI: `getByRole`, `getByLabelText`,
  `getByAltText`, `getByText`. Avoid `data-testid`; if a control cannot be found
  by role and name, fix the component's accessible name.
- Assert localized strings from the i18next `t()` function, not hardcoded
  English. Module-scope `t()` is safe here — i18next init is synchronous.
- See [examples/testing-library-component.md](examples/testing-library-component.md).

## Server unit tests (node)

- Run with `make test-unit-server` (Jest node env, `TEST_ENV=server`, scoped to
  `src/test/apollo-server`).
- Stand up an Apollo Server 5 instance with `startStandaloneServer` on
  `port: 0`, inject resolver mocks per test, and assert on the HTTP/GraphQL
  response shape (status, `errors`, `data`).
- Cover the failure and boundary paths the resolver can reach: validation
  errors, duplicate-key rejection, CSRF blocking, thrown resolver errors.

## E2E (Playwright + Mockoon)

- Run with `make test-e2e` (or `make test-e2e-ui` for the inspector). The target
  builds and starts the prod stack first; the GraphQL backend is the **Mockoon**
  service from `docker-compose.test.yml`.
- Use accessible Playwright locators (`getByRole`, `getByLabel`,
  `getByPlaceholder`); reach for CSS/`locator()` only for structure with no
  accessible name.
- Override individual responses with `page.route('**/graphql', handler)` to drive
  error and edge paths; `unroute` afterward. Do not change Mockoon defaults to
  paper over an app bug.
- Specs run across chromium, firefox, and webkit. See
  [examples/playwright-flow.md](examples/playwright-flow.md) and
  [reference/mockoon-apollo.md](reference/mockoon-apollo.md).

## Visual regression

- Run with `make test-visual`. Baselines are committed in adjacent
  `*-snapshots/` folders, one image per browser/viewport.
- Stabilize before `toHaveScreenshot`: await `document.fonts.ready` and settle
  `document.getAnimations()` so diffs are not font/animation flake.
- Update baselines with `make test-visual-update` **only** after a deliberate,
  reviewed UI change, and inspect every regenerated image before committing.
  Webkit baselines can drift ~2px on Playwright upgrades — regenerate, do not
  raise the diff threshold. See
  [examples/visual-regression.md](examples/visual-regression.md).

## Test data with faker

Build fixtures with `@faker-js/faker` (see
`src/test/testing-library/fixtures/`). Faker is **not** globally seeded, so never
assert against a hardcoded faker value — capture the generated value in a
variable and assert against that variable, keeping each run independent.

## Verify before done

Run only the suites your change touches, then the lint gate. Any unit suite runs
locally without Docker when prefixed with `CI=1`.

```bash
make format                   # Prettier (run before lint)
CI=1 make test-unit-client    # client unit (jsdom)
CI=1 make test-unit-server    # server unit (node)
make test-e2e                 # user-facing flows (UI/behavior changes)
make test-visual              # visual regression (UI/styling changes)
make lint                     # ESLint + tsc + markdownlint + dependency-cruiser
```

## Related guides

Before applying this skill, confirm the task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill
is consulted.

## Supporting files

- [reference/jest-environments.md](reference/jest-environments.md): TEST_ENV
  routing and which spec folder maps to which env.
- [reference/mockoon-apollo.md](reference/mockoon-apollo.md): Mockoon e2e backend
  and Apollo mock behavior.
- [reference/selectors-and-a11y.md](reference/selectors-and-a11y.md): behavior-
  first selector priority.
- [examples/testing-library-component.md](examples/testing-library-component.md):
  component test.
- [examples/playwright-flow.md](examples/playwright-flow.md): e2e flow.
- [examples/visual-regression.md](examples/visual-regression.md): visual test.
