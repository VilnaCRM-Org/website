[![SWUbanner](./public/supportUkraine.svg)](https://supportukrainenow.org/)

# Template for modern SSR applications

[![CodeScene Code Health](https://codescene.io/projects/43861/status-badges/code-health)](https://codescene.io/projects/43861)
[![CodeScene System Mastery](https://codescene.io/projects/43861/status-badges/system-mastery)](https://codescene.io/projects/43861)
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
  make install: installs node modules according to the current pnpm-lock.yaml file
  make check-node-version: checks if the correct Node.js version is installed
```

Linting & Formatting

```bash
  make lint-next: lints the codebase using Next.js rules
  make lint-tsc: runs static type checking with TypeScript
  make lint-md: lints all markdown files (excluding CHANGELOG.md) using markdownlint
  make lint-deps: validates architecture/import boundaries with dependency-cruiser
  make lint: runs all linters (ESLint, TypeScript, markdownlint, and dependency-cruiser)
  make lint-metrics: runs the rust-code-analysis complexity gate (host-only, not in make lint)
```

Testing

```bash
  make test-unit-all: runs unit tests for both client and server environments
  make test-unit-client: runs unit tests for the client using Jest
  make test-unit-server: runs unit tests for the server using Jest
  make test-integration: runs the integration layer (real Apollo transport, network stubbed)
  make test-integration-watch: runs the integration layer in watch mode
  make test-bats: runs the Bats shell regression suite for Makefile targets and CI helper scripts
  make test-memory-leak: runs memory leak tests using Memlab
  make load-tests: executes load tests using the K6 library
  make test-e2e: runs end-to-end tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-load: alias for load-tests (K6 homepage load tests)
  make test-load-swagger: alias for load-tests-swagger (K6 Swagger load tests)
```

Local CI Orchestration

These targets run the same grouped CI phases the pipeline uses, adapted to
website's pnpm + Next.js toolchain, so developers and agents can reproduce a
full CI run — or any single phase — locally:

```bash
  make ci: runs the full local CI flow (setup → lint → dev tests → mutation → prod setup → prod tests)
  make ci-setup: prepares the shared dev container for CI-oriented checks
  make ci-lint: runs the lint phase (ESLint, TypeScript, Markdown) in parallel with grouped output
  make ci-test: runs the dev-side tests (unit client/server, integration) in parallel
  make ci-mutation: runs Stryker mutation testing in isolation
  make ci-prod-setup: starts the prod stack and installs Chromium/LHCI for prod-side tests
  make ci-test-prod: runs the prod-side tests (e2e, visual, memory-leak, load, lighthouse) sequentially
  make ensure-dev: starts the dev service only when it is not already running
```

The phases are also exposed as individual entrypoints so CI workflows can fan
them out independently: `ci-test-unit-client`, `ci-test-unit-server`,
`ci-test-integration` (dev-side) and `ci-test-e2e`, `ci-test-visual`,
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

Note: The following commands do not require the `CI=1` prefix:

```bash
  make test-e2e: starts production and runs end-to-end tests inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-memory-leak: runs memory leak tests using Memlab inside the prod container

  make load-tests: executes load tests using the K6 library
  (uses "prod" as hostname, which maps to the Docker service)

  make git-hooks-install: installs husky Git hooks locally
  make update: runs locally on the host machine, not in a container
```

💡 Tip: To run commands locally without Docker, please prefix command with CI=1.
Example:

```bash
  CI=1 make start
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

## Routing

This project includes a routing script for managing URLs.
The routing script maps requests to the correct HTML files, ensuring proper navigation.
For detailed information, check the [routing script](scripts/cloudfront_routing.js).

### How It Works

- Mapping: Specific URL paths are mapped to corresponding HTML files.
- Fallback Logic: For undefined routes, the script appends /index.html to handle directory-like paths.
- Error Handling: If an error occurs, the script logs it and returns the original request.

This routing logic is useful for SSR (Server-Side Rendered) applications,
particularly when hosted on platforms like AWS CloudFront.

## Documentation

Start reading at the [GitHub wiki](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki).
If you're having trouble, head for
[the troubleshooting guide](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki/Troubleshooting)
as it's frequently updated.

For production deploys, the post-deploy smoke test, and the rollback procedure,
see the [deployment and rollback runbook](docs/deployment-runbook.md).

You can generate complete API-level documentation by running `doc` in the top-level
folder, and documentation will appear in the `docs` folder, though you'll need to have
[API-Extractor](https://api-extractor.com/) installed.

If the documentation doesn't cover what you need, search the
[many questions on Stack Overflow](http://stackoverflow.com/questions/tagged/vilnacrm),
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
