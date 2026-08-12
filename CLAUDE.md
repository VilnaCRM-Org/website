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
make test-e2e           # Playwright E2E (prod stack + Mockoon API mock)
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

Two gates sit deliberately outside `make lint`: `make lint-metrics` (host-only Rust
binary) and `make lint-contracts` (needs network for its drift check). Each has its own
workflow — `rust-code-analysis.yml` and `contract-testing.yml`.

Run `make format` before `make lint`; formatting is intentionally separate from the lint
verification suite. Git hooks are managed by Husky. CI phases are mirrored locally by
`make ci-lint`, `make ci-test`, and `make ci` (see the Makefile's CI orchestration
section). Use `make pr-comments PR=<num> FORMAT=<text|json|markdown>` to fetch unresolved
PR review comments.

Never satisfy a gate with `eslint-disable`, `prettier-ignore`, a markdownlint disable, or a
lowered threshold — fix the root cause.

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
  scope's `break` (`scripts/ci/merge-mutation-reports.ts`). The split is a total partition,
  so the merged score equals an unsharded run and the merge job fails closed.

### Mutation scope (issue #345)

`config/mutation-policy.json` is the single source of truth for what gets mutated and at
what threshold. `MUTATION_SCOPE` selects one of three slices; everything downstream — the
Stryker shard config, the Jest test set, and the merge gate — reads that one decision.

| Scope     | What it mutates                           | Gate                             | Where           |
| --------- | ----------------------------------------- | -------------------------------- | --------------- |
| `curated` | the fixed list in `stryker.config.mjs`    | blocking at 100%                 | PR              |
| `changed` | mutable files the PR touches vs. its base | blocking at 85%, cap → advisory  | PR              |
| `full`    | every mutable file in `src/`              | advisory; files a tracking issue | nightly `02:00` |

A file is "mutable" when it lives under an `api`/`helpers`/`hooks`/`utils`/`validations`
**path segment** and is not a spec, story, type, style, i18n bundle, asset, constant, mock,
or fixture (`scripts/ci/mutation-scope.ts`). The filter is on directories, not on file
extension: a `.tsx` under `hooks/` is logic and is mutated, while a presentational component
is excluded because it does not sit under one of those segments. That boundary is the point
— mutating a style object yields equivalent mutants no test can kill, which renders a gate
unfalsifiable rather than strict.

A mutable file whose behaviour no spec in the mutation runner's test set reaches is dropped
from the list and named in the run log, never scored. Stryker runs with
`enableFindRelatedTests`; when Jest resolves no related spec it runs nothing, exits 0, and
every mutant reads as _survived_ — identical to a genuinely weak test.
`api/graphql/apollo.ts`, whose only coverage is the integration layer, is the live example.
Reporting a survivor for a test that exists is how a gate gets its threshold lowered.

The `changed` leg gates below 100% on purpose. A file mutated for the first time carries
pre-existing debt its author did not create, and blocking on that only teaches reviewers to
click past the check; the nightly census is where that backlog is tracked. When a PR touches
more mutable files than `changed.maxFiles`, the leg degrades to advisory **and** truncates
the list to the cap — degrading the verdict alone would leave the run free to hit the job
timeout, reddening the very check the cap exists to keep off the critical path.

Locally: `make test-mutation-changed` (add `MUTATION_BASE_REF=<ref>` to diff against
something other than `origin/main`). Never lower a `break`, widen the exclusion list, or add
a scope to dodge a surviving mutant — write the assertion the mutant proves is missing.

One acceptance criterion of #345 — adding the changed-files leg to `main`'s
required-status-checks ruleset — needs repository-admin access and cannot be committed from
a PR. Until the separate ci-health ruleset issue lands, that check is advisory at merge time
(as is every other check on `main`, which carries no required checks today).

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
