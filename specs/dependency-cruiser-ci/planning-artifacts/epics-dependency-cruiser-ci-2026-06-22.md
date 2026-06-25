---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
inputDocuments:
  - specs/dependency-cruiser-ci/planning-artifacts/prd-dependency-cruiser-ci-2026-06-22.md
  - specs/dependency-cruiser-ci/planning-artifacts/architecture-dependency-cruiser-ci-2026-06-22.md
---

# website - Epic Breakdown

## Overview

This epic breakdown turns the Dependency Cruiser CI PRD (`prd-dependency-cruiser-ci-2026-06-22.md`) and its companion architecture (`architecture-dependency-cruiser-ci-2026-06-22.md`) into an implementable plan for adding `dependency-cruiser` as a CI-enforced architecture-governance gate to the VilnaCRM **website** repository. The work installs `dependency-cruiser ^17.x` as a devDependency, authors a single root-level `.dependency-cruiser.js` (CommonJS, sixteen `forbidden` rules plus an `options` block) adapted from the CRM sister repo but rewritten for the website's **feature-based** structure (there is no `src/modules` layer) and made PascalCase-safe, wires a `make lint-deps` target into the `lint` aggregate with a DIND wrapper, adds a dedicated `.github/workflows/dependency-cruiser.yml` workflow that auto-runs on every pull request to `main` and fails on any `error`-severity violation, and documents the rules, usage, and exception protocol in the README. The deliverable is additive, low-blast-radius developer tooling: no `src/` files change, the dependency graph is clean today (zero cross-feature imports, no cycles), and the gate is therefore expected green on introduction.

## Requirements Inventory

### Functional Requirements

Restated verbatim from the PRD (`## Functional Requirements`):

- FR1: The repository can declare `dependency-cruiser ^17.x` as a devDependency installed through the existing `pnpm@10.6.5` / `make install` flow, matching the CRM sister repo's major version.
- FR2: A `.dependency-cruiser.js` CommonJS configuration file can define a `forbidden` rule array and an `options` block that together drive all architecture and hygiene checks.
- FR3: The configuration can resolve the `@/*` path alias and TypeScript `bundler` module resolution by referencing `tsconfig.json` and configuring `enhancedResolveOptions` (TS-first extensions, exports/condition names, mainFields).
- FR4: The configuration can confine analysis to source code by excluding `node_modules` from traversal and enabling `skipAnalysisNotInRules` for performance.
- FR5: The configuration can recognize `k6` and `k6/http` as built-in modules so load-test imports are not reported as unresolvable, while deliberately not registering bun built-ins.
- FR6: The configuration can fail the build on any circular dependency (`no-circular`, severity error), closing the gap left by the unconfigured ESLint `import/no-cycle` rule.
- FR7: The configuration can require that code outside a feature import that feature only through its public `index` barrel (`features-import-via-public-api`, severity error), formalizing the existing ESLint `no-restricted-imports` `@/features/*/*` rule at the dependency-graph level.
- FR8: The configuration can forbid any feature from importing any sibling feature at all (`no-cross-feature-imports`, severity error).
- FR9: The configuration can forbid the shared UI library (`src/components`) from depending on any feature (`no-shared-ui-to-features`, severity error).
- FR10: The configuration can forbid the foundational shared layers (`src/shared`, `src/config`, `src/hooks`, `src/utils`, `src/lib`, `src/providers`, `src/types`, `src/routes`, `src/stores`) from depending on any feature (`no-shared-layers-to-features`, severity error).
- FR11: The configuration can require feature directory names to be lowercase kebab-case (`src-feature-name-kebab-case`, severity error). **This rule is explicitly mandated by the stakeholder.**
- FR12: The configuration can scope lowercase-path enforcement to feature directory names only and deliberately omit CRM's global `no-uppercase-paths` rule, so PascalCase component directories (`UiButton`, `AboutUs`) do not produce false positives. **This deviation from CRM must be documented as an explicit decision.**
- FR13a: The configuration can restrict a feature root to an approved set of subfolders — `api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils` — and flag any other top-level folder inside a feature (`feature-allowed-folders`, severity error).
- FR12a: The configuration can flag orphaned (unused) modules (`no-orphans`, severity error) while exempting dot-files, `*.d.ts`, config files (babel/webpack/commitlint/stryker/jest/lighthouse, `next.config.js`, `i18n.js`, etc.), `__mocks__`, Next.js `pages/` entrypoints, Storybook, coverage, and report-output directories via a `pathNot` allowlist.
- FR12b: The configuration can warn on imports of deprecated core modules and deprecated npm packages (`no-deprecated-core`, `not-to-deprecated`, severity warn).
- FR12c: The configuration can error on dependencies that are unresolvable or absent from `package.json` (`not-to-unresolvable`, `no-non-package-json`, severity error), excluding `http(s)://` URLs.
- FR12d: The configuration can warn when a dependency is declared under more than one dependency type (`no-duplicate-dep-types`, severity warn), excluding type-only declarations.
- FR12e: The configuration can forbid production code from importing test folders (`not-to-test`) and from importing `.spec`/`.test` files (`not-to-spec`), both severity error.
- FR12f: The configuration can forbid `src` runtime code from importing devDependencies (`not-to-dev-dep`, severity error), excluding spec/test files and `@types` packages.
- FR13: A `make lint-deps` target can run dependency-cruiser over `src` and `tests` using `.dependency-cruiser.js`, invoked through the `PNPM_EXEC` wrapper so it runs inside the dev Docker container by default and directly on the runner when `CI=1`.
- FR14: The `lint` aggregate target can include `lint-deps` (`lint: lint-next lint-tsc lint-md lint-deps`) so `make lint` runs all four linters in sequence, and `make help` can list `lint-deps` via its trailing `##` description comment.
- FR15: A DIND wrapper `run-deps-lint-tests-dind` can run `make lint-deps CI=1` inside a test container, mirroring the existing `run-eslint-tests-dind` pattern.
- FR16: A dedicated `.github/workflows/dependency-cruiser.yml` workflow can run dependency-cruiser automatically on every `pull_request` targeting `branches: [main]`.
- FR17: The CI workflow can fail the pull request (non-zero exit / failed required check) whenever any `error`-severity violation is detected.
- FR18: The CI workflow can pin the Node version to the `${{ vars.NODE_VERSION }}` repository variable, install `pnpm@10.6.5`, cache pnpm dependencies, and run `make install` before `make lint-deps CI=1`, consistent with `static-testing.yml`.
- FR19: The CI workflow can declare least-privilege `permissions: contents: read` and check out the repository with a SHA-pinned action and `persist-credentials: false`.
- FR23: The design can document, and recommend against relying solely on, the alternative of riding the existing `static-testing.yml` `make lint` gate; the dedicated workflow is the authoritative gate for CRM parity and isolated failure reporting (while both coexist safely).
- FR20: The README can include a "Dependency Cruiser / Architecture rules" section listing every rule and its intent.
- FR21: The tooling can produce human-readable violation output that names the violated rule, the source module, and the target module, so a developer can act on it without consulting the config.
- FR22: The README can document `make lint-deps` usage (local and CI) and explain how to add a justified, scoped exception to the configuration rather than disabling rules wholesale.

### Non-Functional Requirements

Restated verbatim from the PRD (`## Non-Functional Requirements`):

- NFR1: A full cruise of `src` and `tests` must complete within the existing static-testing time budget — target under ~30 seconds on the CI runner, comparable to the ESLint step — aided by `skipAnalysisNotInRules: true` and excluding `node_modules` from traversal.
- NFR2: The analysis must not require building the application or starting any service; it operates on the source graph only, keeping the CI job lightweight.
- NFR3: The check must be deterministic: the same commit produces the same pass/fail result on every run, with no flakiness.
- NFR4: Graph analysis (cycles, orphans, boundaries) must be reproducible across local and CI environments given identical source and config.
- NFR5: The check must run with no network access required at analysis time (all dependencies already installed by `make install`), avoiding external-service flakiness.
- NFR6: Any `error`-severity violation must cause a non-zero exit code and a failed CI check; `warn`-severity rules must surface in output without failing the build.
- NFR7: Violation output must be actionable — naming the rule, source, and target — so failures are self-explanatory in the CI log.
- NFR8: The tooling must work with Node `>=20` pinned via `${{ vars.NODE_VERSION }}`, the `pnpm@10.6.5` package manager, and the Makefile `CI=1` / `PNPM_EXEC` execution pattern, both inside the dev Docker container and directly on the CI runner.
- NFR9: On the current `main`, the gate must report **zero false positives** — there are zero cross-feature imports and no cycles today, and PascalCase component directories must not be flagged (lowercase enforcement is scoped to feature names only).
- NFR10: The configuration must remain compatible with the website's `next.config.js` (`output: 'export'`, `transpilePackages`), TypeScript `bundler` moduleResolution, and the single `@/*` alias, resolving them correctly.
- NFR11: The tooling must mirror the CRM sister-repo pattern — same dependency-cruiser major version (`^17.x`), same Makefile integration conventions (`BIN_DIR`, per-tool `*_BIN` var, aggregate `lint` target, DIND wrapper), and same dedicated-workflow shape — so engineers moving between repos encounter a consistent experience.
- NFR12: Naming and structure of the new target, wrapper, workflow, and config must follow the website's existing conventions (kebab-case feature directories, PascalCase component directories, camelCase helper/hook files, `package.json` with no `scripts` section — all task-running via the Makefile).

### Additional Requirements (architecture-derived)

These derive from the architecture decisions (`architecture-dependency-cruiser-ci-2026-06-22.md`) and constrain implementation beyond the raw FR/NFR text:

- AR1 (AD-1): The config is a single root-level **CommonJS** `.dependency-cruiser.js` (`module.exports = { forbidden: [...16 rules...], options: {...} }`) — not ESM/`.mjs`/`.ts` — for zero-config consumption by the `depcruise` binary and CRM parity.
- AR2 (AD-2): The `options` block must set `tsPreCompilationDeps: true`, `combinedDependencies: true`, and `detectProcessBuiltinModuleCalls: true` so type-only edges (`import type`) and process built-in calls are captured by the graph.
- AR3 (AD-3): Boundary rules must use the exact regex shapes specified — the `no-cross-feature-imports` capture-group/negative-lookahead pattern (`from ^src/features/([^/]+)/`, `to ^src/features/(?!$1/)`) and the barrel allowance `(?!index[.]...)` — so they are correct one layer shallower than CRM (no module nesting).
- AR4 (AD-4): `no-uppercase-paths` must be ABSENT from the config and `src-feature-name-kebab-case` must be PRESENT and scoped to the first path segment under `src/features/`; future maintainers must not "restore" the CRM global lowercase rule.
- AR5 (AD-5): `reporterOptions` for `dot`, `archi`, and `text` reporters with the `node_modules` collapse pattern must be configured; `builtInModules.add` lists exactly `k6` and `k6/http` and deliberately omits bun built-ins.
- AR6 (AD-6): The Makefile binary variable is `DEPCRUISE_BIN = $(BIN_DIR)/depcruise`; the target invokes `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js`; the tool is never invoked via a `package.json` `scripts` entry.
- AR7 (AD-7): The dedicated workflow is named `dependency cruiser`, runs with `env: CI: 1`, uses a SHA-pinned `actions/checkout` (`v4.1.1`, commit `b4ffde65f46336ab88eb53be808477a3936bae11`) with `persist-credentials: false`, `actions/setup-node@v4` at `node-version: ${{ vars.NODE_VERSION }}`, `actions/cache@v4.2.3` keyed on `pnpm-lock.yaml`, then `npm install -g pnpm`, conditional `make install`, and `make lint-deps CI=1`.
- AR8 (AD-8): The exception protocol is a narrow, justified `pathNot`/`comment` addition scoped to the specific rule, reviewed in PR — never a whole-rule disable.
- AR9 (Constraint): This is a planning-artifacts-only program of work for the spec phase; the **implementation stories below describe the changes a future PR will apply** to `package.json`, `.dependency-cruiser.js`, the `Makefile`, the workflow, and the README. No story touches `src/`.

### UX Design Requirements

None apply. This is developer tooling / CI infrastructure: there is no end-user interface, no visual design, no front-end component, and no UX flow in scope. The only "interface" is the human-readable CLI/CI violation output covered by FR21/NFR7.

### FR Coverage Map

Every FR from the PRD is covered by at least one story below.

| FR | Subject | Epic | Story |
| --- | --- | --- | --- |
| FR1 | `dependency-cruiser ^17.x` devDependency | Epic 1 | 1.1 |
| FR2 | `.dependency-cruiser.js` skeleton (`forbidden` + `options`) | Epic 1 | 1.2 |
| FR3 | `@/*` alias / `bundler` resolution options | Epic 1 | 1.2 |
| FR4 | analysis-scope / performance options | Epic 1 | 1.2 |
| FR5 | `k6` built-in modules; no bun | Epic 1 | 1.2 |
| FR6 | `no-circular` | Epic 2 | 2.1 |
| FR7 | `features-import-via-public-api` | Epic 2 | 2.2 |
| FR8 | `no-cross-feature-imports` | Epic 2 | 2.2 |
| FR9 | `no-shared-ui-to-features` | Epic 2 | 2.3 |
| FR10 | `no-shared-layers-to-features` | Epic 2 | 2.3 |
| FR11 | `src-feature-name-kebab-case` (stakeholder-mandated) | Epic 2 | 2.4 |
| FR12 | omit `no-uppercase-paths`; scope to feature names | Epic 2 | 2.4 |
| FR13a | `feature-allowed-folders` | Epic 2 | 2.5 |
| FR12a | `no-orphans` + allowlist | Epic 3 | 3.1 |
| FR12b | `no-deprecated-core`, `not-to-deprecated` | Epic 3 | 3.2 |
| FR12c | `not-to-unresolvable`, `no-non-package-json` | Epic 3 | 3.2 |
| FR12d | `no-duplicate-dep-types` | Epic 3 | 3.2 |
| FR12e | `not-to-test`, `not-to-spec` | Epic 3 | 3.3 |
| FR12f | `not-to-dev-dep` | Epic 3 | 3.3 |
| FR13 | `make lint-deps` target | Epic 4 | 4.1 |
| FR14 | `lint` aggregate + `make help` | Epic 4 | 4.1 |
| FR15 | `run-deps-lint-tests-dind` wrapper | Epic 4 | 4.2 |
| FR16 | dedicated workflow auto-runs on PR->main | Epic 5 | 5.1 |
| FR17 | fails on `error` violations | Epic 5 | 5.1 |
| FR18 | node version var, pnpm, cache, `make install` | Epic 5 | 5.1 |
| FR19 | hardened permissions + pinned checkout | Epic 5 | 5.2 |
| FR23 | document alternative; recommend dedicated workflow | Epic 5 | 5.2 |
| FR20 | README rules section | Epic 6 | 6.1 |
| FR21 | actionable violation output | Epic 6 | 6.1 |
| FR22 | usage + how to add exceptions | Epic 6 | 6.2 |

## Epic List

### Epic 1: Tooling Foundation

Establishes the substrate everything else builds on: the additive `dependency-cruiser ^17.x` devDependency installed through the existing `pnpm@10.6.5` / `make install` flow, and the root-level CommonJS `.dependency-cruiser.js` skeleton — its `module.exports = { forbidden: [], options: {} }` shape plus the full `options` block that makes the graph analyzable at all (alias/`bundler` resolution pinned to `tsconfig.json`, `enhancedResolveOptions`, `node_modules` excluded, `skipAnalysisNotInRules`, `k6` built-ins, reporter options). Until the resolver options exist, no rule can run without flooding on unresolvable `@/*` edges, so this epic is the prerequisite for Epics 2 and 3.

**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: Feature Architecture Boundary Rules

Authors the core contribution of this work: the six feature-based boundary rules and the stakeholder-mandated naming rule, expressed directly against `src/features/<feature>/`, `src/components/`, and the foundational shared layers (no `src/modules`). This epic delivers `no-circular` (closing the unconfigured `import/no-cycle` gap), `features-import-via-public-api`, `no-cross-feature-imports`, `no-shared-ui-to-features`, `no-shared-layers-to-features`, `feature-allowed-folders`, and `src-feature-name-kebab-case` — together with the deliberate, documented omission of CRM's global `no-uppercase-paths` so PascalCase component directories stay zero-false-positive.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13a

### Epic 3: Generic Hygiene Rules

Ports and adapts the generic graph-hygiene rules from CRM: the `no-orphans` rule with its comprehensive `pathNot` entrypoint/output allowlist; the deprecation and resolvability advisories (`no-deprecated-core`, `not-to-deprecated`, `not-to-unresolvable`, `no-non-package-json`, `no-duplicate-dep-types`); and the production-vs-test and runtime-vs-devDependency separations (`not-to-test`, `not-to-spec`, `not-to-dev-dep`). These rules keep the graph clean without producing false positives against the website's entrypoints and generated output.

**FRs covered:** FR12a, FR12b, FR12c, FR12d, FR12e, FR12f

### Epic 4: Local Developer Workflow

Makes the gate runnable locally and part of the standard lint pass. Adds the `DEPCRUISE_BIN` variable and the `make lint-deps` target invoked through `PNPM_EXEC` (dev container by default, runner when `CI=1`), extends the `lint` aggregate to `lint: lint-next lint-tsc lint-md lint-deps` with a `make help` description, and adds the `run-deps-lint-tests-dind` DIND wrapper mirroring `run-eslint-tests-dind` for in-container parity.

**FRs covered:** FR13, FR14, FR15

### Epic 5: CI Enforcement

Turns the gate into an authoritative, automatic, hardened required check. Adds the dedicated `.github/workflows/dependency-cruiser.yml` workflow that runs on every `pull_request -> branches:[main]`, fails the PR on any `error`-severity violation, pins Node to `${{ vars.NODE_VERSION }}`, installs and caches pnpm, runs `make install` then `make lint-deps CI=1`, declares least-privilege `permissions: contents: read`, and checks out with a SHA-pinned action and `persist-credentials: false`. It also documents the alternative of riding `static-testing.yml` and records the dedicated workflow as the recommended authoritative gate.

**FRs covered:** FR16, FR17, FR18, FR19, FR23

### Epic 6: Documentation

Converts the gate from a roadblock into a self-service tool. Adds the README "Dependency Cruiser / Architecture rules" section listing every rule and its intent, documents the actionable violation format (rule / source / target) so developers can act without reading the config, documents `make lint-deps` usage (local and `CI=1`), and explains the exception protocol — adding a justified, scoped `pathNot`/`comment` to the specific rule reviewed in PR rather than disabling enforcement wholesale.

**FRs covered:** FR20, FR21, FR22

## Epic 1 Stories: Tooling Foundation

### Story 1.1: Add dependency-cruiser devDependency at CRM-parity version

As a CI maintainer,
I want `dependency-cruiser ^17.x` declared as a devDependency and installed through the existing pnpm / `make install` flow,
So that the website has the same architecture-governance tool at the same major version as the CRM sister repo.

**Acceptance Criteria:**

- **Given** the website `package.json`, **When** the implementation adds the dependency, **Then** `dependency-cruiser` appears under `devDependencies` with a `^17.x` range matching CRM's `^17.3.7` major (FR1, NFR11).
- **Given** the additive change, **When** the dependency is added, **Then** no `scripts` section is introduced into `package.json` — all task-running remains via the Makefile (NFR12).
- **Given** the existing flow, **When** `make install` is run, **Then** `pnpm@10.6.5` resolves and installs `dependency-cruiser`, the lockfile updates deterministically, and the `depcruise` binary is available under `./node_modules/.bin/` (FR1, NFR8).
- **And** no file under `src/` is touched by this change (NFR9).

### Story 1.2: Author the .dependency-cruiser.js skeleton and resolver/scope options

As a CI maintainer,
I want a root-level CommonJS `.dependency-cruiser.js` with the complete `options` block (alias resolution, analysis scope, performance, built-ins, reporters),
So that the import graph for `src` and `tests` is correctly resolvable and the rule arrays added later run with zero false positives.

**Acceptance Criteria:**

- **Given** the repository root, **When** the config is created, **Then** it is a CommonJS file exporting `module.exports = { forbidden: [], options: {...} }`, ready to receive the sixteen rules (FR2, AR1).
- **Given** every internal import uses `@/...`, **When** `options` is authored, **Then** it sets `tsConfig.fileName: 'tsconfig.json'` and an `enhancedResolveOptions` block with `exportsFields: ['exports']`, `conditionNames: ['import','require','node','default','types']`, TS-first `extensions: ['.ts','.tsx','.d.ts','.js','.jsx']`, and `mainFields: ['main','types','typings']` so `@/*` and `bundler` moduleResolution resolve correctly (FR3, NFR10).
- **And** `options` sets `tsPreCompilationDeps: true`, `combinedDependencies: true`, and `detectProcessBuiltinModuleCalls: true` so type-only (`import type`) edges and process built-in calls are captured (AR2).
- **Given** performance and scope requirements, **When** `options` is authored, **Then** it sets `doNotFollow.path: ['node_modules']` and `skipAnalysisNotInRules: true` (FR4, NFR1, NFR2, NFR5).
- **Given** the website's k6 load tests import `k6`/`k6/http`, **When** `options.builtInModules` is authored, **Then** it adds exactly `['k6','k6/http']` and deliberately does NOT add any bun built-ins (FR5, AR5).
- **And** `options.reporterOptions` configures the `dot`, `archi`, and `text` reporters, with `dot`/`archi` using the `node_modules/(?:@[^/]+/[^/]+|[^/]+)` collapse pattern and `text` using `highlightFocused: true` (AR5).
- **And** running `depcruise` against current `main` with this skeleton resolves all internal `@/*` edges without `not-to-unresolvable`-style flooding (NFR9, NFR10).

## Epic 2 Stories: Feature Architecture Boundary Rules

### Story 2.1: Add the no-circular rule to close the import/no-cycle gap

As a developer,
I want any circular dependency to fail the build,
So that the gap left by ESLint's unconfigured `import/no-cycle` rule is permanently closed for everyone.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** the rule is added, **Then** it is named `no-circular` with severity `error`, `from: {}` and `to: { circular: true }`, carrying a `comment` stating intent (FR6, AR3).
- **Given** a module graph that contains a cycle, **When** `make lint-deps` runs, **Then** the rule fires, prints the full cycle path, and produces a non-zero exit (FR6, NFR6, NFR7).
- **And** against current `main` (which has no cycles), the rule produces zero violations (NFR9).

### Story 2.2: Add feature public-API barrel and no-cross-feature rules

As a developer,
I want code outside a feature to import it only through its public `index` barrel and no feature to import a sibling feature at all,
So that the feature-slice contract is enforced at the dependency-graph level beyond what the per-file ESLint rule can catch.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `features-import-via-public-api` is added, **Then** it has severity `error`, `from: { path: '^src/', pathNot: '^src/features/[^/]+/' }`, and `to: { path: '^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+' }`, formalizing ESLint `no-restricted-imports ['@/features/*/*']` at graph level (FR7, AR3).
- **Given** an outside module imports `@/features/swagger/helpers/formatDate` (past the barrel), **When** `make lint-deps` runs, **Then** `features-import-via-public-api` fires and names the source and target modules (FR7, NFR7).
- **Given** the `forbidden` array, **When** `no-cross-feature-imports` is added, **Then** it has severity `error`, `from: { path: '^src/features/([^/]+)/' }`, and `to: { path: '^src/features/(?!$1/)' }`, using the capture-group/negative-lookahead pattern so a feature importing a sibling fails (FR8, AR3).
- **Given** a module in the `landing` feature imports from the `swagger` feature, **When** `make lint-deps` runs, **Then** `no-cross-feature-imports` fires (FR8).
- **And** against current `main` (zero cross-feature imports), both rules produce zero violations (NFR9).

### Story 2.3: Add shared-UI and shared-layer feature-agnostic rules

As a developer,
I want the shared UI library and the foundational shared layers to be forbidden from depending on any feature,
So that shared code stays reusable and feature-agnostic and the dependency direction stays one-way.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `no-shared-ui-to-features` is added, **Then** it has severity `error`, `from: { path: '^src/components/' }`, and `to: { path: '^src/features/' }` (FR9).
- **Given** the `forbidden` array, **When** `no-shared-layers-to-features` is added, **Then** it has severity `error`, `from: { path: '^src/(?:shared|hooks|utils|lib|providers|types|config|routes|stores)/' }`, and `to: { path: '^src/features/' }`, covering both populated (`shared`, `config`) and reserved-empty layers (FR10).
- **Given** a shared component or shared layer imports from `src/features/`, **When** `make lint-deps` runs, **Then** the corresponding rule fires and names the source and target (FR9, FR10, NFR7).
- **And** against current `main`, both rules produce zero violations (NFR9).

### Story 2.4: Add the stakeholder-mandated kebab-case feature-name rule and omit no-uppercase-paths

As a developer,
I want feature directory names enforced as lowercase kebab-case while PascalCase component directories are left untouched,
So that the stakeholder-mandated naming convention holds without flooding the build with false positives on the codebase's PascalCase components.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `src-feature-name-kebab-case` is added, **Then** it has severity `error`, `from: { path: '^src/features/(?![a-z0-9-]+/)[^/]+/' }`, `to: {}`, and a `comment` stating that feature directory names must be lowercase kebab-case (FR11, AR4).
- **Given** the headline deviation from CRM, **When** the config is authored, **Then** CRM's global `no-uppercase-paths` rule is ABSENT from `forbidden` (FR12, AR4).
- **Given** a feature directory `src/features/UserOnboarding/`, **When** `make lint-deps` runs, **Then** `src-feature-name-kebab-case` fires for that feature name (FR11).
- **And** PascalCase component directories such as `src/components/UiButton/` and `src/features/landing/components/AboutUs/` are NOT flagged by any rule (FR12, NFR9).
- **And** against current `main` (kebab-case feature names only), the rule produces zero violations (NFR9).

### Story 2.5: Add the feature-allowed-folders rule

As a developer,
I want a feature root restricted to an approved set of subfolders,
So that feature slices keep a consistent internal structure and unexpected top-level folders are caught at PR time.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `feature-allowed-folders` is added, **Then** it has severity `error`, `from: { path: '^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/' }`, and `to: {}` (FR13a).
- **Given** a feature contains a top-level folder outside the approved set (`api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`), **When** `make lint-deps` runs, **Then** the rule fires and names the offending path (FR13a, NFR7).
- **And** the existing feature slices (`landing`, `swagger`, and the i18n-only stubs), whose subfolders are all within the approved set, produce zero violations on current `main` (NFR9).

## Epic 3 Stories: Generic Hygiene Rules

### Story 3.1: Add the no-orphans rule with the entrypoint/output allowlist

As a developer,
I want unused (orphan) modules flagged while legitimate entrypoints, configs, and generated output are exempt,
So that dead code is caught without false positives against Next.js pages, Storybook, config files, and report directories.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `no-orphans` is added, **Then** it has severity `error` and `from: { orphan: true, pathNot: [...] }` (FR12a).
- **Given** the `pathNot` allowlist, **When** it is authored, **Then** it exempts dot-files, `*.d.ts`, `tsconfig.json`, `(babel|webpack).config.*`, `(commitlint|stryker).config.*`, `__mocks__/`, `next.config.js`, `jest.config.ts`, `jest.mutation.config.ts`, `babel-jest.config.js`, `i18n.js`, `mutation.js`, `checkNodeVersion.js`, `lighthouserc.*.js`, `^pages/`, `^.storybook/`, `^coverage/`, `^test-results/`, `^playwright-report/`, and `^storybook-static/` (FR12a, AD-5).
- **Given** a genuinely unused module under `src`, **When** `make lint-deps` runs, **Then** `no-orphans` fires and names it (FR12a, NFR7).
- **And** against current `main`, the allowlist suppresses all entrypoint/config/output paths so the rule produces zero false positives (NFR9).

### Story 3.2: Add deprecation, resolvability, and duplicate-dep-type advisories

As a developer,
I want warnings on deprecated/duplicate dependencies and errors on unresolvable or non-package.json imports,
So that dependency hygiene issues surface (as warnings) and unresolvable or undeclared dependencies fail the build.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** the deprecation advisories are added, **Then** `no-deprecated-core` (severity `warn`, `to.dependencyTypes: ['core']` with the deprecated core-module path list) and `not-to-deprecated` (severity `warn`, `to.dependencyTypes: ['deprecated']`) are present (FR12b).
- **Given** the `forbidden` array, **When** the resolvability rules are added, **Then** `not-to-unresolvable` (severity `error`, `to: { couldNotResolve: true, pathNot: ['^https?://'] }`) and the not-present-in-package.json rule (severity `error`, `to.dependencyTypes: ['npm-no-pkg','npm-unknown']`) are present, excluding `http(s)://` URLs (FR12c).
- **Given** the `forbidden` array, **When** `no-duplicate-dep-types` is added, **Then** it has severity `warn`, `to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] }` (FR12d).
- **Given** a `warn`-severity violation, **When** `make lint-deps` runs, **Then** it surfaces in the output but does NOT cause a non-zero exit; an `error`-severity violation DOES cause a non-zero exit (NFR6).
- **And** against current `main`, the `error`-severity rules in this story produce zero violations (NFR9).

### Story 3.3: Add the test/production and runtime/devDependency separation rules

As a developer,
I want production code forbidden from importing test code and `src` runtime code forbidden from importing devDependencies,
So that test-only and dev-only code never leaks into the shipped runtime graph.

**Acceptance Criteria:**

- **Given** the `forbidden` array, **When** `not-to-test` is added, **Then** it has severity `error`, `from: { pathNot: '^(?:src/test|tests)' }`, and `to: { path: '^(?:src/test|tests)' }` (FR12e).
- **Given** the `forbidden` array, **When** `not-to-spec` is added, **Then** it has severity `error`, `from: {}`, and `to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' }` (FR12e).
- **Given** the `forbidden` array, **When** `not-to-dev-dep` is added, **Then** it has severity `error`, `from: { path: '^src', pathNot: '[.](?:spec|test)[.]...$' }`, and `to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] }`, excluding spec/test files and `@types` packages (FR12f).
- **Given** production code that imports a test folder, a `.spec`/`.test` file, or a devDependency, **When** `make lint-deps` runs, **Then** the corresponding rule fires with a non-zero exit (FR12e, FR12f, NFR6, NFR7).
- **And** against current `main`, all three rules produce zero violations (NFR9).

## Epic 4 Stories: Local Developer Workflow

### Story 4.1: Add the make lint-deps target and wire it into the lint aggregate

As a developer,
I want a single `make lint-deps` command that runs dependency-cruiser over `src` and `tests`, included in `make lint`,
So that I can validate architecture boundaries locally before opening a PR and the standard lint pass covers it automatically.

**Acceptance Criteria:**

- **Given** the Makefile, **When** the variable is added, **Then** `DEPCRUISE_BIN = $(BIN_DIR)/depcruise` is declared alongside the existing per-tool `*_BIN` vars (FR13, AR6, NFR12).
- **Given** the Makefile, **When** the target is added, **Then** `lint-deps` runs `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` and carries a trailing `## ...` description comment (FR13, AR6).
- **Given** the `PNPM_EXEC` wrapper, **When** `make lint-deps` is run with no flags, **Then** it executes inside the dev Docker container; **When** run with `CI=1`, **Then** it executes `depcruise` directly on the runner (FR13, NFR8).
- **Given** the aggregate target, **When** it is extended, **Then** the line reads `lint: lint-next lint-tsc lint-md lint-deps` so `make lint` runs all four linters in sequence (FR14).
- **And** `make help` lists `lint-deps` via its trailing `##` description comment (FR14).

### Story 4.2: Add the run-deps-lint-tests-dind wrapper

As a CI maintainer,
I want a DIND wrapper that runs `make lint-deps CI=1` inside a test container,
So that dependency-cruiser has the same in-container execution parity as the existing ESLint DIND wrapper.

**Acceptance Criteria:**

- **Given** the Makefile, **When** the wrapper is added, **Then** `run-deps-lint-tests-dind` mirrors the `run-eslint-tests-dind` pattern, requires `TEMP_CONTAINER_NAME`, and runs `cd /app && make lint-deps CI=1` inside the container (FR15, NFR11).
- **Given** the wrapper, **When** it is invoked without `TEMP_CONTAINER_NAME`, **Then** it fails with the standard required-env-var error used by the sibling DIND wrappers (FR15).
- **And** the wrapper carries a trailing `## ...` description so it appears in `make help` (FR15, NFR12).

## Epic 5 Stories: CI Enforcement

### Story 5.1: Add the dedicated dependency-cruiser CI workflow

As a CI maintainer,
I want a dedicated workflow that runs dependency-cruiser automatically on every PR to `main` and fails on any error-severity violation,
So that architecture-boundary violations are blocked at PR time as their own isolated required check.

**Acceptance Criteria:**

- **Given** `.github/workflows/`, **When** the workflow is added, **Then** `dependency-cruiser.yml` triggers on `pull_request` with `branches: [main]` and sets `env: CI: 1` (FR16, AR7).
- **Given** the workflow job, **When** it runs, **Then** it sets up Node via `actions/setup-node@v4` at `node-version: ${{ vars.NODE_VERSION }}`, caches pnpm via `actions/cache@v4.2.3` keyed on `pnpm-lock.yaml`, installs pnpm via `npm install -g pnpm`, runs `make install` (conditional on cache miss), then `make lint-deps CI=1` (FR18, NFR8).
- **Given** a PR that introduces any `error`-severity violation, **When** the workflow runs, **Then** `make lint-deps CI=1` exits non-zero and the required check fails (FR17, NFR6).
- **Given** a PR with only `warn`-severity findings or none, **When** the workflow runs, **Then** the check passes (NFR6).
- **And** against the introducing PR itself (clean graph on `main`), the workflow completes well within the static-testing budget (target under ~30 s) and passes green (NFR1, NFR9).

### Story 5.2: Harden workflow permissions and document the static-testing alternative

As a security-conscious CI maintainer,
I want the workflow to run with least-privilege permissions and a SHA-pinned checkout, and the design to record why the dedicated workflow is preferred over riding the lint gate,
So that the gate is supply-chain-hardened and future maintainers understand the authoritative-gate decision.

**Acceptance Criteria:**

- **Given** the workflow, **When** permissions are declared, **Then** it sets least-privilege `permissions: contents: read` at the appropriate scope (FR19).
- **Given** the checkout step, **When** it is authored, **Then** it uses a SHA-pinned `actions/checkout` (`b4ffde65f46336ab88eb53be808477a3936bae11`, v4.1.1) with `persist-credentials: false` (FR19, AR7).
- **Given** the FR23 alternative, **When** the design is documented, **Then** it notes that `lint-deps` already runs inside `static-testing.yml` via the `make lint` aggregate, that both mechanisms coexist safely, and recommends the dedicated workflow as the authoritative gate for CRM parity and isolated failure reporting (FR23).
- **And** the workflow filename, name, and shape mirror the CRM `dependency-cruiser.yml` and the website's existing 18 workflows (NFR11, NFR12).

## Epic 6 Stories: Documentation

### Story 6.1: Add the README rules section and document actionable violation output

As a developer,
I want a README section listing every dependency-cruiser rule and its intent, plus an explanation of the violation output format,
So that I can understand the architecture rules and act on a failure without reading the config file.

**Acceptance Criteria:**

- **Given** the README, **When** the section is added, **Then** a "Dependency Cruiser / Architecture rules" section lists each of the sixteen rules with its name, severity, and intent (FR20).
- **Given** the documentation of output, **When** it is authored, **Then** it explains that a violation names the violated rule, the source module, and the target module, with an example, so a developer can act without consulting the config (FR21, NFR7).
- **And** the documented rule set matches the config exactly — including that `src-feature-name-kebab-case` is present and CRM's global `no-uppercase-paths` is deliberately omitted, with the rationale (FR20, FR12).

### Story 6.2: Document make lint-deps usage and the exception protocol

As a developer,
I want documented usage for `make lint-deps` (local and CI) and a clear protocol for adding a justified exception,
So that I can run the gate correctly and request a scoped exception in PR instead of silently disabling a rule.

**Acceptance Criteria:**

- **Given** the README, **When** usage is documented, **Then** it shows `make lint-deps` for local/container runs and `make lint-deps CI=1` for direct-runner runs, and notes it is part of `make lint` (FR22).
- **Given** the exception protocol, **When** it is documented, **Then** it instructs maintainers to add a narrow, justified `pathNot`/`comment` scoped to the specific rule, reviewed in PR, and explicitly warns against disabling a whole rule to silence a single violation (FR22, AR8).
- **And** the documentation states that the preferred resolution is to fix the offending dependency, with an exception used only when the dependency is legitimate (FR22).
