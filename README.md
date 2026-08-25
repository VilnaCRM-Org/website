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

- **[Bun](https://bun.sh/)** (the version pinned in [`.bun-version`](.bun-version) and
  `package.json`'s `packageManager`). Bun is the package manager, not the runtime — the
  toolchain still runs on the Node pinned above.

- **[Docker](https://docs.docker.com/engine/install/)** for containerization and managing
  isolated environments. Install Docker according to the instructions
  for your operating system. Follow the guide to ensure Docker is properly
  configured and running on your machine.

- **[Docker Compose](https://docs.docker.com/compose/install/)** to manage multi-container
  Docker applications. Docker Compose starts up the development environment and runs the
  services defined in docker-compose.yml.

Docker is the default execution substrate. Every gate except the K6 load suites has a
Docker-free path documented under [Host mode](#host-mode-running-without-docker), and the
dev container below packages the whole toolchain for Codespaces and agent sandboxes.

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

#### 4. Or open it in a Dev Container

[`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) gives Codespaces, VS
Code Dev Containers, and agent sandboxes a ready environment with no host setup: open the
repository in a dev container and the toolchain is already correct.

It builds the `base` stage of the repository [`Dockerfile`](Dockerfile) — the same stage
`docker-compose.yml` builds for the `dev` service — so Node, Bun, and the build toolchain
are declared exactly once and cannot drift from a second set of pins. It sets `CI=1`, so
every `make` target inside the container runs on the host toolchain rather than trying to
`docker compose exec` into itself.

Inside the container:

```bash
  make lint CI=1
  make test-unit-all CI=1
```

The browser suites are the one gap: the base image is Alpine (musl) and Playwright ships no
musl browser builds, which is why the repository runs Playwright from a separate glibc
image. Run the e2e, visual, and memory-leak suites from the host — see
[Host mode](#host-mode-running-without-docker) — and the K6 load suites through Docker,
since their runner is a container image.

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
  make lint-md: lints tracked markdown with markdownlint (see MD_LINT_ARGS for exclusions)
  make lint-deps: validates architecture/import boundaries with dependency-cruiser
  make lint-docker-policy: enforces the Dockerfile registry + digest-pin policy
  make lint-pins: fails when the Node, Bun, or Playwright pins drift between pin sites
  make lint: runs all linters (ESLint, TypeScript, markdownlint, deps, Docker policy, pins)
  make lint-metrics: runs the rust-code-analysis complexity gate (host-only, not in make lint)
  make lint-contracts: validates the pinned user-service contracts (not in make lint; needs network)
  make lint-openapi: reports breaking upstream OpenAPI drift (host-only, needs network; advisory)
  make update-contracts: re-fetches the contracts after bumping USER_SERVICE_VERSION
```

Testing

```bash
  make test-unit-all: runs the client, server, and edge unit layers
  make test-unit-client: runs unit tests for the client using Jest
  make test-unit-server: runs unit tests for the server using Jest
  make test-unit-edge: runs the edge layer (cloudfront_routing.js, public/sw.js; 100%)
  make test-integration: runs the integration layer (real Apollo transport, network stubbed)
  make test-integration-watch: runs the integration layer in watch mode
  make test-contract: checks the Mockoon mock against the committed OpenAPI contract
  make test-bats: runs the Bats shell regression suite for Makefile targets and CI helper scripts
  make test-memory-leak: runs memory leak tests using Memlab and fails on unaccounted leak clusters
  make load-tests: executes load tests using the K6 library
  make test-e2e: runs end-to-end tests inside the prod container
  make test-e2e-burnin: repeats E2E_BURNIN_SPECS with retries off to expose flaky specs
  make check-e2e-flakes: grades a Playwright JSON report for retry-passes and burn-in flakes
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-load: alias for load-tests (K6 homepage load tests)
  make test-load-swagger: alias for load-tests-swagger (K6 Swagger load tests)
  make playwright-install: installs the Playwright browsers for a host-mode run
  make stop-prod: tears down the prod stack (Docker compose, or the host stack)
```

Playwright runs four projects: `chromium`, `firefox`, and `webkit` against the desktop
viewport, plus `mobile-chrome` — real Pixel 7 emulation with touch input, a mobile user
agent, and `devicePixelRatio` 2.625 — scoped to `src/test/e2e/mobile/**`. That scoping is
deliberate: Playwright interpolates the project name into screenshot filenames, so an
unscoped project would demand a second complete set of visual baselines.

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

Note: these commands run against the Docker prod stack and ignore the `CI=1` prefix. They
take `HOST_STACK=1` instead — see below.

```bash
  make test-e2e: starts production and runs end-to-end tests inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  make test-memory-leak: runs memory leak tests using Memlab inside the prod container
```

These take neither switch:

```bash
  make load-tests: executes load tests using the K6 library — Docker only, and
  require-docker-stack refuses HOST_STACK=1 (uses "prod" as hostname, which maps to the
  Docker service)

  make husky: installs the Husky Git hooks — host toolchain in every mode
  make update: runs bun update on the host machine, not in a container, in every mode
```

### Host mode (running without Docker)

Docker is the default substrate for every target. Two independent switches move work onto
the host. Both are additive: without them, no target changes meaning.

- `CI=1` swaps `docker compose exec dev` for the host toolchain. It covers lint, the unit
  and integration layers, Storybook, and Lighthouse.
- `HOST_STACK=1` additionally replaces the Docker prod stack with a host one: it builds the
  static export, serves it with `serve`, and runs Playwright from `node_modules`. It covers
  the e2e, visual, and memory-leak suites.

`HOST_STACK` is deliberately a switch of its own rather than another `CI=1` behaviour.
GitHub Actions sets `CI=true` on every runner, which the Makefile already normalises to
`CI=1`, so the e2e, visual, and memory-leak workflows run in that mode today against the
Docker stack their baselines were produced in. Folding the two together would move three
PR jobs off those containers without anyone asking for it.

```bash
  HOST_STACK=1 make playwright-install   # one-time: fetch the browsers
  HOST_STACK=1 make test-e2e             # build, serve, and run the e2e suite on the host
  HOST_STACK=1 make test-visual          # advisory locally, see the caveat below
  HOST_STACK=1 make test-memory-leak     # memlab against the host-served export
  HOST_STACK=1 make stop-prod            # tear the host stack down
```

| Suite                   | Docker-free command                  |
| ----------------------- | ------------------------------------ |
| Lint, unit, integration | `CI=1 make <target>`                 |
| End-to-end              | `HOST_STACK=1 make test-e2e`         |
| Visual regression       | `HOST_STACK=1 make test-visual`      |
| Memory leak (memlab)    | `HOST_STACK=1 make test-memory-leak` |
| Load (K6)               | Docker only                          |

Two limits, both deliberate:

- **Visual comparisons are advisory on the host.** Baselines are produced inside the pinned
  Playwright image, and Playwright runs with no `maxDiffPixels`, so host font rasterization
  can diff a snapshot that is genuinely unchanged. The container run stays the gate of
  record, and `make test-visual-update` refuses to run under `HOST_STACK=1` so that
  host-rendered baselines can never be committed.
- **K6 load tests are Docker-only.** The runner is a container image built by `xk6` with a
  compiled Go extension, and it addresses the site by its Compose service name. There is no
  host equivalent that would stay in parity, so none is offered.

`make playwright-install` fetches the browser binaries, but not the OS libraries they link
against. WebKit is the usual casualty and it fails at launch rather than at install, so a
missing package shows up as one identical "Host system is missing dependencies" error per
test. Installing them needs root:

```bash
  sudo ./node_modules/.bin/playwright install-deps chromium firefox webkit
```

💡 Tip: the Git hooks already use host mode — `.husky/pre-commit` and
`.husky/pre-push` run every gate with `CI=1`, so committing works on a machine with no
Docker daemon.

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

## Progressive Web App

The site is installable: [`public/layout/favicon/site.webmanifest`](public/layout/favicon/site.webmanifest)
declares `display: "standalone"` with an `id`, an icon set, and a shortcut to `/swagger`.

[`public/sw.js`](public/sw.js) is what keeps that promise honest. Without a worker, an
installed app launched offline opens straight onto the browser's network-error page, inside
a window with no address bar to escape from. The worker precaches exactly one document —
`/offline.html`, exported from [`pages/offline.tsx`](pages/offline.tsx) — and serves it only
when a same-origin navigation fails.

It is deliberately not a caching layer:

- Nothing is written to the cache at runtime, and hashed `_next/static` chunks are never
  precached, so a deploy can never be shadowed by a stale entry.
- Any request that is not a same-origin navigation returns before `respondWith`, so the
  browser handles it exactly as if no worker were installed. That is what keeps the
  Playwright `page.route` mocks and the Mockoon-backed e2e stack observing real requests.
- `activate` evicts every cache generation other than the current one, and the worker calls
  `skipWaiting()` and `clients.claim()` so an update takes effect on the next navigation
  rather than after every tab has closed.

Rules for changing any of this:

- Write the worker through `globalThis` member access only. `public/` is linted, and bare
  `self`/`addEventListener` are `no-restricted-globals` errors while `clients`/`skipWaiting`
  are `no-undef` errors. Suppressing either is banned.
- The fallback is reached as `/offline.html`, never `/offline` — the CloudFront edge
  function hard-404s an extensionless single-segment path.
- `public/sw.js` is gated at 100% per-file coverage by the edge Jest layer
  (`make test-unit-edge`), the same layer that covers the CloudFront handler.
- Every navigable URL in the manifest is checked against the real route set by
  `src/test/unit/pwa/manifest-contract.test.ts`. That gate exists because the manifest once
  advertised a shortcut to a `/dashboard` route that does not exist.
- To retire the worker, ship an `sw.js` that unregisters itself and clears its caches;
  deleting the file leaves already-installed workers running against clients indefinitely.

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
