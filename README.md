[![SWUbanner](./public/supportUkraine.svg)](https://supportukrainenow.org/)

# Template for modern SSR applications

[![codecov](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template/graph/badge.svg?token=MPFDUSMZ2I)](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template)

## Possibilities

- A modern JavaScript-based stack for services: [React](https://react.dev/), [Next.js](https://nextjs.org/).
- Extensive CI checks (including security checks, code style fixing, static linters, DeepScan, and Snyk)
  ensure the highest code quality.
- Configured testing tools: [Playwright](https://playwright.dev/), [Jest](https://jestjs.io/).
- This template is based on [bulletproof-react](https://github.com/alan2207/bulletproof-react/tree/master),
  but has been adapted to meet the specific needs of this project and may differ from the original implementation.
- Much more!

## Why you might need it

Many front-end developers need to create new projects from scratch and spend a lot of time.

We decided to simplify this exhausting process and create a public template for modern
front-end applications. This template is used for all our microservices in VilnaCRM.

## License

This software is distributed under the
[Creative Commons Zero v1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/deed) license.
Please read [LICENSE](https://github.com/VilnaCRM-Org/frontend-ssr-template/blob/main/LICENSE) for information
on the software availability and distribution.

### 🚀 Minimal Installation Guide

#### 1. Clone the Repository

Clone locally or use GitHub’s `Use this template` feature.

#### 2. Install Prerequisites

Before running the application, make sure the following tools are installed on your machine:

- **[Node.js](https://nodejs.org/en/)** (the LTS pinned in [`.nvmrc`](.nvmrc) — run `nvm use`).
  You can download and install Node.js from the official website, or use a version manager like
  nvm [Node Version Manager](https://github.com/nvm-sh/nvm) to easily manage versions.

- **[Docker](https://docs.docker.com/engine/install/)** required for containerization and managing
  isolated environments. Install Docker according to the instructions
  for your operating system. Follow the guide to ensure Docker is properly
  configured and running on your machine.

- **[Docker Compose](https://docs.docker.com/compose/install/)** is needed to manage multi-container
  Docker applications. Docker Compose is essential for starting up the
  development environment and running the services defined in docker-compose.yml.

#### 3. Run the Application

After installing all prerequisites, you can start the application inside a Docker container:

```bash
   make start
```

**What Happens When You Run `make start`**:

The command will:

- Build and start the project inside a Docker container named `dev`.
- Install all the necessary dependencies (including Node.js dependencies) inside the container.
- The application will be up and running.

Access the application at <http://localhost:3000>.

## Project Commands

To view all available commands, run `make help`:

```bash
  make help
```

The following commands are available when the project is installed locally.

General

```bash
  make start: starts the application
  make build: builds the application
  make format: formats the codebase to ensure consistent style across all files
  make update: updates node modules according to the current package.json file
  make install: installs node modules according to the current bun.lock file
  make check-node-version: checks if the correct Node.js version is installed
```

Linting & Formatting

```bash
  make lint-next: lints the codebase using Next.js rules
  make lint-tsc: runs static type checking with TypeScript
  make lint-md: lints all markdown files (excluding CHANGELOG.md) using markdownlint
  make lint-deps: validates architecture/import boundaries with dependency-cruiser
  make lint-api-versions: verifies OpenAPI and GraphQL reference the same pinned user-service release
  make lint-docker-policy: enforces the Dockerfile registry + digest-pin policy
  make lint-headers: verifies the edge security-header policy reaches every response
  make lint-security-txt: validates the RFC 9116 security.txt fields and Expires runway
  make lint-prod-guardrails: enforces the production-safety invariants (issue #383)
  make lint: runs all linters (ESLint, TypeScript, markdownlint, dependency-cruiser,
    API versions, Docker policy, security headers, security.txt, production guardrails)
  make lint-metrics: runs the rust-code-analysis complexity gate (host-only, not in make lint)
  make lint-contracts: validates the pinned user-service contracts (not in make lint; needs network)
  make lint-openapi: reports breaking upstream OpenAPI drift (host-only, needs network; advisory)
  make lint-workflows: audits the GitHub Actions workflows with zizmor (host-only, not in make lint)
  make update-contracts: re-fetches the contracts after bumping USER_SERVICE_VERSION
  make lint-vulns: fails on dependency CVEs this branch adds vs main (host-only, not in make lint)
  make scan-vulns-census: reports every known dependency CVE in bun.lock without failing
```

Testing

```bash
  make test-unit-all: runs unit tests for both client and server environments
  make test-unit-client: runs unit tests for the client using Jest
  make test-unit-server: runs unit tests for the server using Jest
  make test-integration: runs the integration layer (real Apollo transport, network stubbed)
  make test-integration-watch: runs the integration layer in watch mode
  make test-contract: checks the Mockoon mock against the committed OpenAPI contract
  make test-bats: runs the Bats shell regression suite for Makefile targets and CI helper scripts
  make test-memory-leak: runs memory leak tests using Memlab and fails on unaccounted leak clusters
  make load-tests: executes load tests using the K6 library
  make test-e2e: runs end-to-end tests (with the interaction-state a11y scans) inside the prod container
  make test-e2e-burnin: repeats E2E_BURNIN_SPECS with retries off to expose flaky specs
  make check-e2e-flakes: grades a Playwright JSON report for retry-passes and burn-in flakes
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-a11y: runs the component and route WCAG 2.1 AA gates (jest-axe + axe/keyboard routes)
  make test-a11y-components: runs the jest-axe component scans only
  make test-a11y-routes: runs the axe route scans inside the prod container
  make test-load: alias for load-tests (K6 homepage load tests)
  make test-load-swagger: alias for load-tests-swagger (K6 Swagger load tests)
```

Local CI Orchestration

These targets run the same grouped CI phases the pipeline uses, adapted to
website's Bun + Next.js toolchain, so developers and agents can reproduce a
full CI run — or any single phase — locally:

```bash
  make ci: runs the full local CI flow (setup → lint → dev tests → mutation → prod setup → prod tests)
  make ci-setup: prepares the shared dev container for CI-oriented checks
  make ci-lint: runs the lint phase (ESLint, TypeScript, Markdown) in parallel with grouped output
  make ci-test: runs the dev-side tests (unit client/server, integration) in parallel
  make ci-mutation: runs Stryker mutation testing in isolation
  make ci-prod-setup: starts the prod stack and installs Chromium/LHCI for prod-side tests
  make ci-test-prod: runs the prod-side tests (e2e, visual, a11y, memory-leak, load, lighthouse) sequentially
  make ensure-dev: starts the dev service only when it is not already running
```

The phases are also exposed as individual entrypoints so CI workflows can fan
them out independently: `ci-test-unit-client`, `ci-test-unit-server`,
`ci-test-integration` (dev-side) and `ci-test-e2e`, `ci-test-visual`, `ci-test-a11y`,
`ci-test-memory-leak`, `ci-test-load`, `ci-test-lighthouse-desktop`,
`ci-test-lighthouse-mobile` (prod-side).

Repository Helpers

```bash
  make pr-comments: retrieves unresolved PR review comments (PR=<num> FORMAT=<text|json|markdown>)
  make start-prod-clean: force-rebuilds and recreates the prod test stack, then waits for health
```

### Important Note About Swagger E2E Tests

For Swagger E2E tests, the application uses Mockoon to handle API requests.
The API endpoints from the Swagger schema are automatically rewritten during
both production and development container builds. This means that all API requests
are currently directed to Mockoon instead of a real backend. Please keep
this in mind if you plan to integrate with a real backend service in
the future—you'll need to update the API configuration accordingly.

To run tests locally, the Mockoon mock server is automatically started via
`make test-e2e`. For manual setup, see the Mockoon configuration in
`docker-compose.test.yml`.

Because the entire Playwright suite talks to Mockoon rather than a real backend,
the mock is itself gated — see
[API contract parity](#api-contract-parity-mockoon-vs-openapi) below.

Lighthouse

```bash
  make lighthouse-desktop: runs Lighthouse audits in desktop mode
  make lighthouse-mobile: runs Lighthouse audits in mobile mode
```

Git

```bash
  make husky: sets up Husky (Git hooks manager) — run once after cloning the repo
```

Storybook

```bash
  make storybook-start: starts Storybook UI
  make storybook-build: builds Storybook UI
```

Docker

```bash
  make down: stops the Docker containers and removes orphaned containers
  make stop: stops Docker
  make start-prod: builds image and starts the container in production mode
  make ps: logs into the Docker container
  make sh: logs into the Docker container
  make logs: shows all logs
  make new-logs: shows live logs of the dev container
  make wait-for-prod: waits for the prod service to be ready on port 3001
```

Note: the following commands never run inside the dev container — they drive Docker
itself, the prod/test compose stack, or the host toolchain directly:

```bash
  make test-e2e: starts production and runs end-to-end tests inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-memory-leak: runs memory leak tests using Memlab inside the prod container

  make load-tests: executes load tests using the K6 library
  (uses "prod" as hostname, which maps to the Docker service)

  make husky: installs husky Git hooks locally
  make update: runs locally on the host machine, not in a container
```

💡 Tip: the npm-tool gates listed above run inside the dev container, which is exactly
what CI does; the targets in the previous block stay on the host in both modes. To bypass
Docker and run a container-side one straight from `node_modules/.bin` — what the
Husky hooks do, so a commit works with no daemon running — prefix it with
`EXEC_MODE=host`. That path reads the host `node_modules`, which `make install`
populates alongside the container's.

```bash
  EXEC_MODE=host make start
```

### Bats Shell Coverage

Use the Bats suite to validate Makefile shell flows and `scripts/ci` helpers that are
not already exercised by the pull request workflows:

```bash
  make test-bats
```

The coverage inventory lives in `tests/bats/make-target-coverage.tsv`. When you add a
new Makefile target, either add Bats coverage for it or document the workflow that
already exercises it in that file. Additional suite-maintenance notes live in
`tests/bats/README.md`.

### Load Testing with K6

This project includes a dedicated load testing service using K6, configured via a Docker Compose profile.

#### What are Docker Compose Profiles?

Docker Compose profiles let you selectively start groups of services. The load testing service is tagged
with the `load` profile in `docker-compose.test.yml`, so it only runs when you explicitly include
that profile.

#### Running Load Tests

Using the `make` command (recommended):

```bash
  make load-tests
```

The load testing service waits for the production service to become healthy before starting.
Test results will be streamed to the K6 web dashboard and saved under ./src/test/load/results/.

Available Load Test Scenarios:

- smoke: a quick health check with a small number of virtual users.
- average: simulates a typical daily traffic load.
- stress: pushes the system to its limits to identify breaking points.
- spike: sudden ramp-up of virtual users to test burst handling.

Adjust scenarios and thresholds in ./src/test/load/config.json.dist as needed.

## Architecture Rules (dependency-cruiser)

Architectural boundaries are enforced with
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser). The rules
live in [`.dependency-cruiser.js`](.dependency-cruiser.js), run locally via
`make lint-deps` (also part of the aggregate `make lint`), and are validated in
CI on every pull request to `main` by `.github/workflows/dependency-cruiser.yml`.

### What is enforced

- **No circular dependencies** anywhere in the graph.
- **Feature isolation**: code outside a feature may import it only through its
  public barrel (`src/features/<feature>/index.ts`); a feature must not import a
  sibling feature.
- **Shared layers stay feature-agnostic**: `src/components` (shared UI) and the
  foundational layers (`shared`, `hooks`, `utils`, `lib`, `providers`, `types`,
  `config`, `routes`, `stores`) must not depend on `src/features`.
- **Feature directory names** must be lowercase `kebab-case`. Component
  directories stay `PascalCase` by convention, so lowercase enforcement is
  scoped to feature names only.
- **Allowed feature subfolders**: `api`, `assets`, `components`, `constants`,
  `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`.
- **Hygiene**: no orphan modules, no production imports of test files or
  `devDependencies`, and no unresolved / not-in-`package.json` imports.

Tests (`src/test`, `tests`) are exempt from the feature-boundary and
devDependency rules — they may import internals and dev tooling directly.

### Running it

```bash
make lint-deps        # validate locally (depcruise over src and tests)
make lint             # run every linter, including dependency-cruiser
```

CI fails the build on any violation.

### Adding an exception

Prefer fixing the boundary violation. When an exception is genuinely warranted,
adjust the relevant rule in `.dependency-cruiser.js` — narrow its `from`/`to`
globs, add a `pathNot` entry, or (only for unavoidable cases) lower its
`severity` to `warn` — and leave a comment explaining why so the boundary intent
stays clear.

## API Contract Parity (Mockoon vs OpenAPI)

Every Playwright e2e run talks to Mockoon, never to a real backend, so a green
e2e suite on its own only proves the app agrees with the **mock**. Two gates keep
that mock honest, both anchored on the single committed baseline
[`contracts/user-service/openapi.json`](contracts/user-service/openapi.json) —
the same artifact `make lint-contracts` drift-gates against `USER_SERVICE_VERSION`
and the same one `Mockoon.Dockerfile` serves. There is deliberately no second
baseline file: a copy would be a drift source with nothing watching it.

### Blocking: mock-vs-contract parity

```bash
make test-contract
```

Boots Mockoon in-process from the committed document — through
`@mockoon/commons-server`, the libraries the container's `@mockoon/cli` wraps —
replays every documented operation, and holds each response against the contract:

- the status served must be one the operation documents;
- a body must arrive under a media type that status declares;
- a body must validate against that media type's schema; and
- a body must not carry a property the schema never declares.

The last rule is stricter than OpenAPI's permissive default on purpose. A mock
offering a field the contract does not describe is precisely the "e2e certifies
behavior the real API does not have" defect, and it is the only rule that catches
a renamed field here, because the upstream document misplaces `required` on the
array schema of `GET /api/users` instead of on its `items`.

Two further checks ride along: the swagger e2e fixtures in
`src/test/e2e/swagger/utils/constants.ts` are validated against the same schema,
and the `@mockoon/*` versions in `package.json` are pinned to the `@mockoon/cli`
version `Mockoon.Dockerfile` installs, so the gate can never certify a Mockoon
the e2e stack does not run.

`tests/contract/parity-detects-drift.contract.test.ts` proves the gate bites: it
writes corrupted **copies** of the mock data — a renamed field, a retyped field,
an added field, a moved status — boots Mockoon on each, and asserts every one
turns the gate red. The gate is hermetic (no Docker, no network) and runs on
every pull request via
[`.github/workflows/contract-parity-testing.yml`](.github/workflows/contract-parity-testing.yml).

**Scope, honestly stated.** Mockoon derives its responses from the same document
the validator checks against, so this cannot detect "the mock disagrees with the
real API" in general. What it does catch is divergence the converter introduces:
a schema the generated mock can no longer satisfy after a version bump, a Mockoon
upgrade that changes generation, a status or media type the mock stops serving,
and e2e fixtures written against a shape the contract has dropped.

Its reach is bounded in three ways, all deliberate and all guarded:

- **One response per operation.** Mockoon serves the first response an operation
  declares and honours neither `Accept` nor `Prefer`, so the documented 4xx/5xx
  shapes are never exercised. 12 responses are observed out of 43 declared
  (status, media-type) pairs.
- **Body only, not headers.** Response headers — including the `Location` on the
  302 — are served but not asserted.
- **Schema-bearing responses only.** 7 of the 12 reach the schema and
  undeclared-property rules; the rest declare `example: ""` with no schema, or
  are bodyless 204s. A committed floor assertion fails if that 7 ever drops, so
  the gate cannot quietly shrink toward validating nothing.

Composed schemas (`allOf`, `oneOf`, `prefixItems`, …) and `$ref` are likewise a
tripwire rather than a silent gap: the undeclared-property rule walks
`properties`/`items` only, so the spec fails loudly if upstream introduces one
instead of quietly checking less.

The "is the contract itself current?" question is the second gate's job.

### Advisory: upstream drift

```bash
make lint-openapi
```

Downloads a pinned, SHA256-verified `oasdiff` binary (the same provisioning
pattern as the rust-code-analysis CLI) and reports breaking changes between the
committed baseline and the newest `VilnaCRM-Org/user-service` **release**. Latest
is resolved from the releases API rather than by semver-sorting tags, because
upstream restarted its numbering: the highest tag by semver is `v2.8.0`
(Aug 2025), while the newest release is `v0.8.0` (Feb 2026). Semver-sorting
would compare against months-old content and report "no drift" indefinitely.

This leg is **advisory by design**: upstream moving on is not a pull request
author's fault, so it never blocks a PR. It runs nightly via
[`.github/workflows/openapi-drift.yml`](.github/workflows/openapi-drift.yml),
which files or refreshes an `api-contract` tracking issue on breaking drift and
closes it once the baseline is current again. Adopt a new contract by bumping
`USER_SERVICE_VERSION` in `.env` and running `make update-contracts`.

[`scripts/ci/openapi-drift.sh`](scripts/ci/openapi-drift.sh) exits three ways on
purpose — `0` clean, `1` breaking drift, `2` the check could not run — so a
network outage is never published as an API change. GNU Make discards a recipe's
own exit status, so the workflow calls the script directly while
`make lint-openapi` stays the human-facing surface.

Like `make lint-contracts` and `make lint-metrics`, `make lint-openapi` is
deliberately **outside** `make lint`: it needs the network and a host binary, and
the static lint lane is hermetic by design.

## Code Metrics (rust-code-analysis)

Per-function and per-file **code complexity** is enforced with Mozilla
[rust-code-analysis](https://github.com/mozilla/rust-code-analysis). The
thresholds live in [`config/metrics-policy.json`](config/metrics-policy.json)
(validated against [`config/metrics-policy.schema.json`](config/metrics-policy.schema.json)),
run locally via `make lint-metrics`, and are validated in CI on every pull
request to `main` by
[`.github/workflows/rust-code-analysis.yml`](.github/workflows/rust-code-analysis.yml).

Unlike the other linters, `rust-code-analysis-cli` is a **standalone Rust
binary**, not an npm package — so this gate runs **host-only** (it cannot run
through the `node:*-alpine` dev container) and is deliberately **not** part of
`make lint` or `CI_LINT_TARGETS`, and ships no DinD wrapper. The CLI only emits
metrics; [`scripts/ci/lint-metrics.sh`](scripts/ci/lint-metrics.sh) parses them
against the policy and owns the pass/fail (collect-all-then-fail).

### What the gate enforces

The analyzer measures `src/` `*.ts`/`*.tsx` only, excluding `src/test`,
`*.d.ts`, `assets`, and `config`. Every metric is either a blocking **hard**
threshold or a non-blocking **review** threshold.

- **Hard (block CI)** — per function/closure: cyclomatic complexity, cognitive
  complexity, ABC magnitude, argument count (NARGS), exit points (NEXITS),
  size/LOC (`lloc`/`ploc`/`sloc`), and Halstead volume & bugs. Per file: number
  of methods (NOM — functions, closures, total), size/LOC, Halstead volume &
  bugs, and a Maintainability-Index floor (`mi_visual_studio`). Class/interface
  bounds (`wmc`, `npm`, `npa`, `coa`, `cda`) are kept hard-but-permissive for
  forward-compatibility; they are inert for TypeScript in v0.0.25.
- **Review (computed, never block)** — the secondary MI variants (`mi_original`,
  `mi_sei`), comment- and blank-ratio band checks, and the remaining Halstead
  submetrics (operators/operands, length, vocabulary, difficulty, level, effort,
  time, purity ratio).

> The hard/review split above mirrors `config/metrics-policy.json`, which is the
> single source of truth — **this list must be kept in sync with that file.**
> Thresholds mirror the CRM sister repository (the shared cross-repo complexity
> standard); the `src/` code is kept within them.

### Running the gate

```bash
make lint-metrics     # host-only; auto-installs the pinned CLI to ./bin on first run
```

A failing run prints an aligned table naming the **file**, **function/scope**
(with its start line), the **metric**, the **measured value**, and the breached
**threshold** — so you can fix every breach in one pass without reading the raw
analyzer JSON. A passing run prints the measured-vs-threshold summary. CI fails
the build on any hard violation; review-tier metrics are computed but are not
currently printed and do not fail the build.

### Raising a budget / adding an exception

Prefer fixing the offending code first — extract helpers, split a god-file,
simplify dense expressions. When a higher budget is genuinely warranted, raise
the relevant threshold in `config/metrics-policy.json` (a reviewed, in-repo
change visible in the PR diff) or confirm the path belongs outside the governed
scope. Do **not** silence the gate with a local override or a per-line disable.

## Workflow Security (zizmor)

The GitHub Actions workflows are audited for supply-chain and privilege defects
with [zizmor](https://docs.zizmor.sh). It runs locally via `make lint-workflows`
and in CI on every pull request, every push to `main`, and weekly, through
[`.github/workflows/workflow-security.yml`](.github/workflows/workflow-security.yml).

`.github/workflows` is the one part of the repo no other gate reads — ESLint,
`tsc`, dependency-cruiser and the metrics gate all stop at `src/`, and the qlty
`zizmor`/`actionlint` plugins are inert here because `.qlty/qlty.toml` excludes
`.github/**` and every `*.yml`. Without this gate a workflow can hand a
privileged token to a mutable action tag and nothing says a word.

Like `lint-metrics`, zizmor is a standalone Rust CLI rather than an npm package,
so the gate runs **host-only** (Docker) and is deliberately **not** part of
`make lint` or `CI_LINT_TARGETS`. The CLI container is pinned **by digest** in
the Makefile (`ZIZMOR_IMAGE`), so a repointed tag can never change what the
security gate enforces.

### What the workflow audit enforces

The gate blocks on findings of **medium severity and above** that zizmor reports
with **high confidence** (`ZIZMOR_MIN_SEVERITY` / `ZIZMOR_MIN_CONFIDENCE` in the
Makefile). That covers the defect classes that matter most here: unpinned or
archived actions, workflow-level over-permissioning, version comments that name
a tag the pinned SHA does not point at, ad-hoc GitHub App tokens with blanket
installation permissions, and known-vulnerable action versions.

Findings below that floor are tracked and ratcheted, never silenced — see the
job comment in `workflow-security.yml` for the current list and why each one is
still open. Raise the floor as they are cleared; never lower it to make a
finding go away, and never add a `zizmor.yml` ignore or a
`# zizmor: ignore[...]` comment.

### Running the workflow audit

```bash
make lint-workflows
```

Online audits resolve action tags against the GitHub API. The gate uses
`GH_TOKEN` (or `GITHUB_TOKEN`) when set and otherwise falls back to the `gh`
CLI's token; with neither it runs `--offline`, which is a strict subset of the
CI run.

## Dependency CVEs (osv-scanner)

Published advisories against the dependency tree are gated with
[osv-scanner](https://github.com/google/osv-scanner), run locally via
`make lint-vulns` and in CI by
[`.github/workflows/osv-scanner.yml`](.github/workflows/osv-scanner.yml).

Like the metrics gate, `osv-scanner` is a **standalone Go binary**, not an npm
package — so this gate runs **host-only** and is deliberately **not** part of
`make lint` or `CI_LINT_TARGETS` (it resolves advisories over the network, and
the static lane is otherwise hermetic).
[`scripts/ci/ensure-osv.sh`](scripts/ci/ensure-osv.sh) provisions the pinned,
SHA256-verified binary to `./bin`;
[`scripts/ci/scan-vulns.sh`](scripts/ci/scan-vulns.sh) only produces JSON, and
[`scripts/ci/check-osv-report.ts`](scripts/ci/check-osv-report.ts) owns every
pass/fail decision.

### The gate is differential, not absolute

The pull-request leg scans the **base branch's** `bun.lock` and the pull
request's, and fails only on advisories the pull request **introduces**.

That is deliberate. The tree carries a large pre-existing advisory backlog, and
OSV publishes new advisories against code nobody touched every week, so an
absolute gate would be red on day one and would keep reddening unrelated pull
requests until somebody hand-edited an ignore file. That failure mode is worse
than no gate: it trains reviewers to click past a security check. Comparing head
against base means the only way to turn this gate red is to actually add
exposure.

Findings are keyed by ecosystem + package + advisory id, **without** the
version: bumping a package to a version that still carries the same advisory is
not new exposure and must not block the bump, while adding a package — or moving
to a version carrying an _additional_ advisory — does.

The nightly leg (`make scan-vulns-census`) covers what the diff cannot see. It
reports the whole backlog into one refreshed tracking issue labelled
`dependency-cve` and stays green by design; a red nightly would page somebody for
debt no author caused.

```bash
make lint-vulns          # blocking: advisories this branch adds vs origin/main
make scan-vulns-census   # advisory: every known advisory in bun.lock
```

### Accepting an advisory

Fix it first: upgrade to a patched version. When an advisory genuinely does not
apply, record it in [`config/osv-scanner.toml`](config/osv-scanner.toml) with an `id`, a
`reason`, and a `ignoreUntil` re-triage date. All three are **enforced**, and the
gate fails once `ignoreUntil` has passed — the same contract
`src/test/memory-leak/leak-baseline.json` applies to memlab allowances. Never add
an entry for an advisory your own change introduced, and never push the date out
to keep a build green.

`[[IgnoredVulns]]` is the only construct that file may contain. Every other table
and every top-level key is rejected, because osv-scanner offers suppression
routes that carry neither a reason nor a date — `[[PackageOverrides]]` with
`ignore = true` drops a package's findings outright, and `LoadConfigs` pulls in
further config files the policy check would never see.

A pull request also cannot change what its own blocking scan suppresses. Both
diff scans run under the **intersection** of the base ref's ignores and the
working tree's — the policy that will be in force after the merge. An ignore the
change _adds_ is not applied (or one diff could carry a vulnerable dependency and
the excuse for it), and an ignore the change _removes_ is not applied either (it
stops suppressing the moment it merges). Land an ignore in its own reviewed
commit first, then the dependency.

## Routing

This project includes a routing script for managing URLs.
The routing script maps requests to the correct HTML files, ensuring proper navigation.
For detailed information, check the [routing script](scripts/cloudfront_routing.js).

### How It Works

The handler is a CloudFront Functions **viewer-request** script and is
**fail-closed** (issue #383): it is the only in-repo layer in front of the S3
origin, so anything it does not recognise must not reach the bucket.

- Mapping: specific URL paths are rewritten to their exported HTML files
  (`/swagger` to `/swagger.html`, and so on).
- Allow-list: every other request passes through only if it is an exact
  allow-listed file, or lives under an allow-listed top-level directory
  (`_next/`, `en/`, `images/`, `layout/`) **and** carries an allow-listed file
  extension.
- Fail-closed default: everything else — `/secret.json`, `/.env`, any `*.map`,
  any unknown nested path — is answered with the site's synthetic 404 instead of
  being forwarded to the origin.
- Completeness gate: `scripts/ci/verify-edge-allowlist.mjs` runs the real handler
  over every file of a freshly built export on each PR, so the allow-list can
  never drift narrower than what the site actually ships.
- Error handling: if the handler itself throws, it logs and returns the original
  request, so a bug in this function can never black-hole the whole site.

This routing logic serves the statically exported site (`output: 'export'`) from
AWS CloudFront in front of an S3 origin.

## Security headers

The production site is a static export, so Next's `headers()` API is a no-op and the
CloudFront edge is the only place security headers can be attached. The policy lives
in [`config/security-headers.json`](config/security-headers.json) and is applied to
every response by the viewer-response function
[`scripts/cloudfront_security_headers.js`](scripts/cloudfront_security_headers.js)
(the synthetic 404 in the routing function carries the same set inline, because
CloudFront skips viewer-response functions for a short-circuited request).

`make lint-headers` — part of `make lint` — runs the checked-in functions and fails if
they stop emitting the policy; the post-deploy smoke test then verifies the live
responses with `curl -I`, which is what catches the functions not being associated with
the distribution. See [the security-headers guide](docs/security-headers.md).

## Documentation

Start reading at the [GitHub wiki](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki).
If you're having trouble, head for
[the troubleshooting guide](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki/Troubleshooting)
as it's frequently updated.

For production deploys, the post-deploy smoke test, and the rollback procedure,
see the [deployment and rollback runbook](docs/deployment-runbook.md).

For the accessibility conformance target, the automated gates behind `make test-a11y` and the
interaction-state scans inside `make test-e2e`, and the exception process, see the
[accessibility acceptance standard](docs/accessibility/acceptance-standard.md).

You can generate complete API-level documentation by running `doc` in the top-level
folder, and documentation will appear in the `docs` folder, though you'll need to have
[API-Extractor](https://api-extractor.com/) installed.

If the documentation doesn't cover what you need, search the
[existing issues](https://github.com/VilnaCRM-Org/website/issues),
and before you ask a question,
[read the troubleshooting guide](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki/Troubleshooting).

## Tests

[Tests](https://github.com/VilnaCRM-Org/frontend-ssr-template/actions)

If this isn't passing, is there something you can do to help?

## Security

Please disclose any vulnerabilities found responsibly – report security issues to the maintainers privately.

See
[SECURITY](https://github.com/VilnaCRM-Org/frontend-ssr-template/tree/main/SECURITY.md)
and
[Security advisories on GitHub](https://github.com/VilnaCRM-Org/frontend-ssr-template/security).

## Contributing

Please submit bug reports, suggestions, and pull requests to the
[GitHub issue tracker](https://github.com/VilnaCRM-Org/frontend-ssr-template/issues).

We're particularly interested in fixing edge cases, expanding test coverage,
and updating translations.

If you found a mistake in the docs, or want to add something, go ahead and
amend the wiki – anyone can edit it.

## Sponsorship

Development time and resources for this repository are provided by
[VilnaCRM](https://vilnacrm.com/),
the free and opensource CRM system.

Donations are very welcome, whether in beer 🍺, T-shirts 👕, or cold, hard cash 💰.
Sponsorship through GitHub is a simple and convenient way to say "thank you" to
maintainers and contributors – just click the "Sponsor" button
[on the project page](https://github.com/VilnaCRM-Org/frontend-ssr-template).
If your company uses this template, consider taking part in the VilnaCRM's enterprise support program.

## Changelog

See [changelog](CHANGELOG.md).
