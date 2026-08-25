# CLAUDE.md

This file gives Claude Code (claude.ai/code) guidance for working in the VilnaCRM
`website` repository. It complements [`agents.md`](agents.md) (the test-coverage
contract) and the skills under [`.claude/skills/`](.claude/skills). Read both before
changing code.

## Project Overview

VilnaCRM's public marketing website / landing, built on Next.js 16 (pages router) with a
bulletproof-react feature layout. It ships a local Apollo Server GraphQL mock for
development, an interactive Swagger page, and a heavily gated CI pipeline. Everything runs
through Makefile targets; the package manager is Bun and Docker backs the dev and test
stacks.

## Tech Stack

- Framework: Next.js 16 (pages router), React 19, TypeScript 6.
- UI: MUI 9 (`@mui/material`, `@mui/system`) with Emotion; Storybook 10; Swiper.
- Data: Apollo Client 4 (`@apollo/client`) against an Apollo Server 5 GraphQL mock;
  `graphql`.
- Forms and i18n: react-hook-form; i18next / react-i18next.
- Observability: `@sentry/node` + `@sentry/react`; Next.js web-vitals reporting.
- Tooling: bun@1.3.5, Node pinned by `.nvmrc` (24.18.0 LTS); Prettier, ESLint (flat config), TypeScript,
  markdownlint, dependency-cruiser.
- Testing: Jest (jsdom + node envs) with React Testing Library; Playwright (chromium,
  firefox, webkit) with Mockoon; Stryker (mutation); K6 (load); memlab (memory);
  Lighthouse CI.

## Mandatory Skill Check (Every Task)

Before any code, doc, or workflow change, every AI agent (Claude Code, Codex, GitHub
Copilot, Cursor, and any other assistant) MUST:

1. Read [`.claude/skills/AI-AGENT-GUIDE.md`](.claude/skills/AI-AGENT-GUIDE.md).
2. Read [`.claude/skills/SKILL-DECISION-GUIDE.md`](.claude/skills/SKILL-DECISION-GUIDE.md).
3. Identify every relevant skill under [`.claude/skills/`](.claude/skills) for the task and
   invoke each match before executing.
4. Apply all relevant skills. Skip one only after recording `Not applicable: <reason>` with
   a concrete justification.

This check is non-negotiable: do not implement, format, lint, test, commit, or push until
the relevant skills have been consulted. BMAD planning skills live separately (see below);
do not mirror them into `.claude/skills`.

## Development

```bash
make start            # Start the dev server (Next.js) via Docker
make sh               # Open a shell in the dev container
make build            # Build the Docker images
make build-out        # Build production artifacts to ./out
make build-analyze    # Build with the bundle analyzer (ANALYZE=true)
make storybook-start  # Run Storybook
make storybook-build  # Build static Storybook
```

Append `CI=1` to run a target on the host without Docker (for example `CI=1 make start`
runs `next dev` directly).

## Testing

```bash
make test-unit-all      # Jest: client (jsdom) + server (node) + edge (node)
make test-unit-client   # Client unit tests (TEST_ENV=client, jsdom)
make test-unit-server   # Apollo server unit tests (TEST_ENV=server, node)
make test-unit-edge     # Edge-script unit tests (TEST_ENV=edge, node; scripts/, 100% per-file)
make test-integration   # Integration layer (TEST_ENV=integration)
make test-contract      # Mockoon mock vs. the committed OpenAPI contract (TEST_ENV=contract)
make test-e2e           # Playwright E2E (prod stack + Mockoon API mock)
make test-e2e-burnin    # Repeat E2E_BURNIN_SPECS with retries off to expose flaky specs
make check-e2e-flakes   # Grade a Playwright JSON report (FLAKE_MODE=retry-pass|burn-in|census)
make test-visual        # Playwright visual regression
make test-visual-update # Refresh visual snapshots after a reviewed UI change
make test-mutation      # Stryker mutation testing
make test-bats          # Bats coverage for Makefile / CI shell flows
make test-memory-leak   # memlab leak detection
make load-tests         # K6 load tests (alias: make test-load)
make lighthouse-desktop # Lighthouse audit (desktop)
make lighthouse-mobile  # Lighthouse audit (mobile)
```

Unit suites accept `CI=1` to run on the host without Docker (e.g. `CI=1 make
test-unit-all`). E2E and visual specs run Playwright inside the prod/test compose stack;
E2E uses Mockoon to mock the API. The test-layer map and coverage policy live in
[`agents.md`](agents.md).

### Flake and leak gates (issues #359, #354)

Two suites that used to run without asserting anything now fail closed:

- **E2E flakes.** `playwright.config.ts` retries twice in CI, so a spec that passes only on
  a retry is reported green. The JSON reporter feeds `scripts/ci/flaky-report.ts`; the
  `e2e flake gate` job fails when a spec **the PR changed** passed on a retry, and the
  `burn in changed e2e specs` job re-runs those specs with `--repeat-each=5 --retries=0`
  and fails at two or more failures. Flakes in untouched specs are annotated, not blocked,
  and the nightly `e2e flake census` tracks them in a labelled issue.
- **Memory leaks.** `src/test/memory-leak/runMemlabTests.js` reads the leak clusters memlab
  returns and exits non-zero for any cluster not recorded in
  `src/test/memory-leak/leak-baseline.json`. Every baseline entry needs a reason, a
  tracking issue, and a `validUntil` date; the gate fails once that date passes.

Never widen a retry budget, raise a leak allowance, or add an allowance for a leak your
change introduced — fix the race or the retainer instead.

### Running a single unit test

```bash
TEST_ENV=client bun x jest src/test/unit/email-validation.test.ts
TEST_ENV=server bun x jest src/test/apollo-server/<spec>.test.ts
```

## Code Quality

```bash
make format     # Prettier (run before lint)
make lint       # lint-next + lint-tsc + lint-md + lint-deps
make lint-next  # ESLint (flat config, eslint.config.mjs)
make lint-tsc   # TypeScript (tsc, no emit)
make lint-md    # markdownlint
make lint-deps  # dependency-cruiser on src, pages, tests
```

Four gates sit deliberately outside `make lint`: `make lint-metrics` (host-only Rust
binary), `make lint-contracts` (needs network for its drift check), `make lint-openapi`
(both — a host Go binary plus the network), and `make lint-vulns` (host-only Go binary,
needs network for the OSV database). Each has its own workflow — `rust-code-analysis.yml`,
`contract-testing.yml`, `openapi-drift.yml`, and `osv-scanner.yml`.

Run `make format` before `make lint`; formatting is intentionally separate from the lint
verification suite. Git hooks are managed by Husky. CI phases are mirrored locally by
`make ci-lint`, `make ci-test`, and `make ci` (see the Makefile's CI orchestration
section). Use `make pr-comments PR=<num> FORMAT=<text|json|markdown>` to fetch unresolved
PR review comments.

Never satisfy a gate with `eslint-disable`, `prettier-ignore`, a markdownlint disable, or a
lowered threshold — fix the root cause.

### API contract parity (issue #350)

Every Playwright e2e run talks to Mockoon, so a green e2e suite alone only proves the app
agrees with the **mock**. Two gates anchored on the single committed baseline
`contracts/user-service/openapi.json` — the artifact `lint-contracts` drift-gates and
`Mockoon.Dockerfile` serves — keep that mock honest. Never add a second copy of the spec.

- **`make test-contract` — blocking, every PR** (`contract-parity-testing.yml`). The
  `TEST_ENV=contract` Jest layer (`tests/contract/**/*.contract.test.ts`) boots Mockoon
  in-process via `@mockoon/commons-server`, replays every documented operation, and asserts
  four rules per response: the status is documented, the media type is declared, the body
  validates against the schema, and the body carries **no property the schema never
  declares**. That last rule is stricter than OpenAPI's permissive default on purpose — it
  is the only one that catches a renamed field here, because upstream misplaces `required`
  on the array schema of `GET /api/users` rather than on its `items`.
  `parity-detects-drift.contract.test.ts` seeds real defects into **copies** of the mock
  data and asserts each turns the gate red; never seed a defect into the committed
  contract, which `lint-contracts` guards. The `@mockoon/*` devDependencies are pinned
  **exactly** to the `@mockoon/cli` version `Mockoon.Dockerfile` installs and a spec
  enforces it — move both pins in the same commit, never relax the assertion.
- **`make lint-openapi` — advisory, nightly** (`openapi-drift.yml`). A pinned,
  SHA256-verified `oasdiff` compares the baseline to the newest upstream **release**
  (resolved from the releases API, not by semver-sorting tags — upstream restarted its
  numbering). `scripts/ci/openapi-drift.sh` exits three ways on purpose: `0` clean, `1`
  breaking drift, `2` the check could not run, so an outage is never published as an API
  change. GNU Make discards a recipe's exit status, so the workflow calls the script
  directly. Breaking drift files/refreshes an `api-contract` issue instead of failing.

### Code Metrics (rust-code-analysis, issue #224)

Issue #224 added a code-complexity gate built on Mozilla rust-code-analysis —
`make lint-metrics`, the policy file `config/metrics-policy.json`, and the CI workflow
`.github/workflows/rust-code-analysis.yml`. This gate is live on `main` (the `lint-metrics`
Makefile target and the `rust-code-analysis.yml` workflow both ship there). The
authoritative thresholds live in `config/metrics-policy.json` and mirror the CRM sister
repo's strict budgets; the same policy file is applied by the local target and the CI
workflow. Hard metrics (cyclomatic, cognitive, ABC, argument and exit counts, function and
file size, Halstead, Maintainability Index) block CI; review-tier metrics are computed but
do not.

Do not lower a threshold, exclude a file, or suppress a metric — reduce the complexity
instead. Read the policy file for the current numbers rather than memorizing them, and see
the [`complexity-management`](.claude/skills/complexity-management/SKILL.md) skill for the
refactoring moves (extract helper, lookup map, typed options object, split file, consolidate
exits).

### Dependency CVEs (osv-scanner, issue #356)

Issue #356 added the repository's only SCA gate — `make lint-vulns`, the ignore policy in
`config/osv-scanner.toml`, and the CI workflow `.github/workflows/osv-scanner.yml`. The binary is
pinned and SHA256-verified into the gitignored `./bin` by `scripts/ci/ensure-osv.sh`.

The PR leg is **differential**: it scans the base branch's `bun.lock` and the PR's, and
fails only on advisories the PR _introduces_. An absolute gate would be red on day one (the
tree carries a large backlog) and would redden unrelated PRs as OSV publishes advisories
against untouched code. Findings are keyed by ecosystem + package + advisory id, without
the version, so bumping to a version carrying the _same_ advisory never blocks the bump.
The nightly `dependency cve census` leg reports the whole backlog into one refreshed
`dependency-cve` issue and stays green.

Never add a `config/osv-scanner.toml` ignore for an advisory your own change introduced, and
never push an `ignoreUntil` date out to keep a build green — upgrade the dependency. Every
ignore needs an `id`, a `reason`, and an unexpired `ignoreUntil`; all three are enforced by
`scripts/ci/osv-ignores.ts`. The rule is also mechanical, not just documented: both diff scans
run under the _intersection_ of the base ref's ignores and the working tree's, so an ignore a
change adds — or removes — cannot alter what its own gate suppresses.

## Continuous Integration (parallel PR pipeline)

Each PR check is its own workflow on its own runner, so they run in parallel and a PR is
gated by the slowest single job, not their sum (issue #316). The layout is
orchestration-only — every check still runs on every PR at the same thresholds; nothing is
tiered off, weakened, or removed.

- **Concurrency.** Every workflow sets a `concurrency` group keyed on the PR/ref. PR checks
  use `cancel-in-progress: true` (a new push cancels the superseded run); the deploy,
  release, and sandbox workflows use `false` so a production trigger is never aborted
  mid-run.
- **Caching.** Node jobs restore the Bun cache (`~/.bun/install/cache`, keyed on the Node version
  and `bun.lock`).
- **Matrices.** The Playwright e2e suite splits across a `--shard` matrix
  (`test-e2e-shard`), Lighthouse runs `desktop`/`mobile` in parallel, the K6 load suites run
  in parallel, and mutation testing runs as a shard matrix plus a merge gate.
- **Mutation sharding.** `make test-mutation-shard` (with `MUTATION_SHARD_INDEX` /
  `MUTATION_SHARD_TOTAL`) writes a per-shard report (`stryker.shard.config.mjs`, with
  `break` disabled); `make merge-mutation-reports` unions the shards and re-enforces the
  exact `break` from `stryker.config.mjs` (`scripts/ci/merge-mutation-reports.ts`). The
  split is a total partition, so the merged score equals an unsharded run and the merge job
  fails closed.

## Architecture

The codebase follows a bulletproof-react, feature-based layout.

```bash
src/
├── features/      # Feature slices: landing, swagger, registration, documentation, example
│   └── <feature>/ #   components, api, hooks, helpers, i18n, types, constants, index.ts
├── components/    # Shared UI primitives (ui-* prefix, e.g. ui-button)
├── hooks/         # Shared hooks
├── lib/           # Shared library code
├── providers/     # React context providers
├── shared/        # Cross-cutting shared modules
├── stores/        # Shared client state
├── config/        # App configuration
├── types/         # Shared types
├── utils/         # Shared utilities
└── test/          # Specs: testing-library, unit, apollo-server, e2e, visual, load, memory-leak
```

Key conventions are enforced by dependency-cruiser in
[`.dependency-cruiser.js`](.dependency-cruiser.js) and surfaced by `make lint-deps`:

- Public-API imports: import a feature through its `index.ts` barrel
  (`features-import-via-public-api`); never reach across features by deep path
  (`no-cross-feature-imports`). Shared layers must not import features
  (`no-shared-ui-to-features`, `no-shared-layers-to-features`).
- Naming: directories and files are kebab-case (`src-feature-name-kebab-case`); shared UI
  primitives use the `ui-*` prefix (for example `src/components/ui-button`).
- Also enforced: `no-circular`, `no-orphans`, `feature-allowed-folders`, and the
  not-to-test / not-to-spec / not-to-dev-dep boundaries.

Imports use the `@/*` alias for `src/*` (plus the feature-scoped `@landing/*` and
`@swagger/*` aliases from [`tsconfig.json`](tsconfig.json)); use a relative path for
same-folder imports.

- i18n: per-feature JSON under `src/features/<feature>/i18n/{en,uk}.json` (react-i18next).
  Assert localized strings via the `t()` helper, not hardcoded English.
- Forms: react-hook-form; validation co-locates with its component (for example
  `components/<name>/validations/`) or lives in `helpers`/`hooks`. There is no feature-root
  `validations/` folder.
- Selectors: prefer user-facing semantic queries (`getByRole`, `getByLabelText`,
  `getByAltText`, `getByText`); avoid `data-testid` (guidance in `agents.md`).
- GraphQL: Apollo Server provides a local mock for development; Apollo Client 4 consumes it.

See [`agents.md`](agents.md) for the test-layer map, the test-coverage policy, and the
Faker test-data builders convention.

## BMAD-METHOD Integration

Planning is driven by a local BMAD / bmalph surface (`_bmad/`, `bmalph/`, and the slash
commands under `.claude/commands/`). These are bmalph-generated and local-only (gitignored);
reference them, but keep them separate from the implementation skills in `.claude/skills/`.

Use `/bmalph` to navigate phases and `/bmalph-status` for a quick overview. Common agents:

| Command       | Role / purpose                        |
| ------------- | ------------------------------------- |
| `/create-prd` | Product requirements (PM)             |
| `/architect`  | Technical design and architecture     |
| `/sm`         | Sprint planning, status, coordination |
| `/dev`        | Implementation and coding             |
| `/qa`         | Test automation and quality assurance |
