---
stepsCompleted:
  - step-01-classify-project
  - step-02-define-success-criteria
  - step-03-map-user-journeys
  - step-04-capture-developer-tooling-requirements
  - step-05-scope-phases
  - step-06-enumerate-functional-requirements
  - step-07-build-traceability-matrix
  - step-08-enumerate-non-functional-requirements
inputDocuments:
  - https://github.com/VilnaCRM-Org/website/issues/225
  - eslint.config.mjs
  - Makefile
  - .github/workflows/static-testing.yml
  - CRM sister-repo .dependency-cruiser.js (reference pattern)
workflowType: prd
classification:
  projectType: developer-tooling
  domain: build-and-ci-architecture-governance
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - Dependency Cruiser CI

**Author:** BMad **Date:** 2026-06-22 **Source:** [website#225](https://github.com/VilnaCRM-Org/website/issues/225)

## Executive Summary

The VilnaCRM website is a feature-based Next.js application whose architectural integrity currently rests on a small set of ESLint rules and on developer discipline. Today there are exactly **zero** cross-feature imports and a clean dependency graph, but nothing automatically guarantees that this stays true. ESLint enforces a single import boundary (`no-restricted-imports` for the pattern `@/features/*/*`, which forbids reaching into a feature past its barrel) and `import/order`, but it does **not** detect circular dependencies (`import/no-cycle` is not configured), cross-feature coupling, orphaned modules, runtime code importing devDependencies, or feature directories drifting away from kebab-case naming. These are graph-level invariants that a per-file linter is poorly suited to enforce.

This PRD specifies the introduction of **dependency-cruiser** as a first-class, CI-enforced architecture governance tool for the website repository. We install `dependency-cruiser ^17.x` as a devDependency, author a `.dependency-cruiser.js` configuration adapted from the CRM sister repository but rewritten for the website's **feature-based** structure (no `src/modules` layer), wire a `make lint-deps` target into the Makefile lint aggregate, add a dedicated `.github/workflows/dependency-cruiser.yml` workflow that auto-runs on every pull request to `main` and fails the build on any violation, and document the rules and usage in the README.

The configuration defines two classes of rules: **generic hygiene rules** (no circular dependencies, no orphans, no imports of deprecated or unresolvable modules, no production code importing test code or devDependencies) ported from CRM, and **architecture boundary rules** that are the core contribution of this work: code outside a feature may import that feature only through its public `index` barrel; a feature must never import a sibling feature; the shared UI library and foundational shared layers must stay feature-agnostic; a feature root may only contain an approved set of subfolders; and — explicitly required by the stakeholder — **feature directory names must be lowercase kebab-case**.

### What Makes This Special

Two characteristics distinguish this work from a naive port of the CRM tooling. First, the website is **feature-based, not module-based**: there is no `src/modules/<module>/features/<feature>` nesting. The boundary rules are therefore expressed directly against `src/features/<feature>/` slices, `src/components/` (the shared UI library), and the foundational shared layers (`src/shared`, `src/config`, and the reserved-but-empty `src/hooks`, `src/utils`, `src/lib`, `src/providers`, `src/types`, `src/routes`, `src/stores`). Second, and most importantly, the website uses **PascalCase component directory names by established convention** (`UiButton`, `AboutUs`, `AppTheme`). CRM's config contains a `no-uppercase-paths` rule that forces every path lowercase; porting it verbatim would emit hundreds of false positives against valid website code. We therefore make a **deliberate, documented deviation**: we drop the global lowercase rule entirely and scope lowercase enforcement to **feature directory names only** via a dedicated `src-feature-name-kebab-case` rule. The net result is a config that is zero-false-positive against the current codebase on day one while closing the real `import/no-cycle` gap and formalizing the feature-boundary contract at the dependency-graph level.

## Project Classification

| Attribute | Value |
| --- | --- |
| Project type | Developer tooling / CI quality gate |
| Domain | Build & CI architecture governance (static analysis of the import graph) |
| Complexity | Medium — single config file plus Makefile and CI wiring; complexity is in correct rule authoring, not in volume of code |
| Project context | Brownfield — established Next.js feature-based codebase with existing Makefile-driven CI and ESLint import enforcement |
| Primary users | Repository contributors (developers), code reviewers, CI maintainers |
| Risk profile | Low blast radius — additive tooling only; no `src/` changes; the gate is new and starts green |

## Success Criteria

### User Success

- A developer can run a single command (`make lint-deps`) locally and receive a clear pass/fail report on architecture and import-boundary violations before opening a pull request.
- When a developer introduces a forbidden dependency (a cycle, a cross-feature import, a deep import past a feature barrel, a non-kebab-case feature directory), they get an actionable, human-readable error naming the offending rule, the source module, and the target module.
- A reviewer no longer has to manually inspect diffs for architecture-boundary violations; the CI gate does it deterministically.

### Business Success

- The website repository gains the same architecture-governance guarantee already in place in the CRM sister repository, bringing the two repos to **tooling parity** and lowering the cost of context-switching for engineers who work across both.
- Architectural drift (cross-feature coupling, dependency cycles) is prevented at PR time rather than discovered during refactors, reducing long-term maintenance cost and protecting the feature-slice modularity that the codebase is built around.

### Technical Success

- The `import/no-cycle` gap is closed: circular dependencies are detected and blocked.
- The existing ESLint `no-restricted-imports` feature-barrel rule is reinforced at the dependency-graph level, catching forms of deep-import that escape the per-file linter (e.g. dynamic or re-exported paths).
- The check is integrated into the Makefile lint aggregate (`lint: lint-next lint-tsc lint-md lint-deps`) and into a dedicated CI workflow that follows the established `CI=1` runner pattern.

### Measurable Outcomes

- **Coverage:** 100% of `src/` and `tests/` modules are analyzed by dependency-cruiser on every PR to `main`.
- **Baseline:** the gate reports **zero violations** against the current `main` (there are zero cross-feature imports and no cycles today), i.e. it is green on introduction.
- **Determinism:** the same commit produces the same result on every run (no flakiness, no network dependence).
- **Performance:** a full cruise of `src` and `tests` completes well within the existing static-testing budget (target: under ~30 seconds on the CI runner, comparable to ESLint).
- **Enforcement:** a pull request that introduces any forbidden dependency is **blocked** (non-zero exit, failed required check).

## User Journeys

### Journey 1: The contributor who accidentally creates a cross-feature import

**Persona:** Maria, a mid-level frontend engineer adding a new component to the `landing` feature.

**Opening Scene:** Maria needs a date-formatting helper. She remembers seeing one in the `swagger` feature and, in a hurry, writes `import { formatDate } from '@/features/swagger/helpers/formatDate'` directly inside a `landing` component.

**Rising Action:** Locally, ESLint flags the deep import (it matches `@/features/*/*`), but Maria has auto-fix noise in her editor and pushes anyway, assuming CI will be the safety net. She opens a PR against `main`.

**Climax:** The `dependency-cruiser` CI workflow runs automatically. It fails with two distinct, named violations: `features-import-via-public-api` (she imported past the `swagger` barrel) and `no-cross-feature-imports` (a `landing` module is reaching into a sibling feature at all). The error text names the exact source and target modules.

**Resolution:** Maria reads the violation, realizes cross-feature reuse is forbidden, and moves the helper into a shared layer (or duplicates it deliberately). She re-runs `make lint-deps` locally, sees it pass, and pushes a clean commit. The required check goes green and the PR is mergeable.

**Reveals requirements for:** the public-API/barrel rule (FR7), the no-cross-feature rule (FR8), the CI workflow that auto-runs and fails on violations (FR16, FR17), the local `make lint-deps` script (FR13), and clear violation reporting (FR21).

---

### Journey 2: The contributor who introduces a circular dependency

**Persona:** Dmytro, a senior engineer refactoring shared UI components.

**Opening Scene:** While extracting a sub-component, Dmytro has `UiCardList` import from `UiCardItem` and, during the refactor, makes `UiCardItem` import a barrel that re-exports `UiCardList`. A cycle is born.

**Rising Action:** TypeScript still compiles. ESLint says nothing — `import/no-cycle` is not configured in the website's ESLint setup. Everything looks fine locally.

**Climax:** On PR, the `no-circular` rule (severity `error`) detects the cycle and fails CI, printing the full cycle path so Dmytro can see exactly which modules form the loop.

**Resolution:** Dmytro breaks the cycle by inverting one of the imports. The build goes green. The previously invisible `import/no-cycle` gap is now permanently closed for everyone.

**Reveals requirements for:** the no-circular rule (FR6), CI enforcement (FR16, FR17), deterministic graph analysis (NFR4), and the closing of the documented ESLint cycle gap (FR6, NFR9).

---

### Journey 3: The contributor who names a new feature directory in PascalCase

**Persona:** Olena, adding a brand-new feature slice for an onboarding flow.

**Opening Scene:** Following the PascalCase convention she sees on shared components (`UiButton`, `AppTheme`), Olena creates `src/features/UserOnboarding/` and starts building.

**Rising Action:** The PascalCase convention is correct for *component* directories, but feature *slice* directory names must be lowercase kebab-case (`landing`, `swagger`, `registration`). Nothing in the editor or in ESLint stops her.

**Climax:** On PR, the `src-feature-name-kebab-case` rule fires with a clear error: the feature directory `UserOnboarding` violates the lowercase-kebab-case naming requirement. (Meanwhile, her PascalCase *component* directories inside the feature are correctly left untouched — the rule is scoped to feature names only.)

**Resolution:** Olena renames the directory to `user-onboarding`, the gate passes, and the repository's naming convention is preserved without a human reviewer having to catch it.

**Reveals requirements for:** the stakeholder-mandated kebab-case feature-name rule (FR11), the deliberate deviation from CRM's global lowercase rule (FR12), and zero-false-positives on PascalCase component directories (NFR9).

---

### Journey 4: The CI maintainer bringing the website to CRM tooling parity

**Persona:** Pavlo, who maintains CI across both the CRM and website repositories.

**Opening Scene:** CRM already has `.dependency-cruiser.js`, a `make lint-deps` target, and a dedicated `dependency-cruiser.yml` workflow. The website has none of these — an inconsistency that bites whenever Pavlo context-switches.

**Rising Action:** Pavlo needs the website gate to mirror CRM's: same devDependency major version (`^17.x`), same Makefile integration style (`PNPM_EXEC`, `BIN_DIR`, `CI=1` toggle, DIND wrapper), same dedicated workflow shape (checkout, setup-node pinned to `${{ vars.NODE_VERSION }}`, pnpm `@10.6.5`, `make install`, `make lint-deps CI=1`).

**Climax:** With the configuration, Makefile target, DIND wrapper, and workflow in place, the website gate behaves identically to CRM's, except for the feature-based rule adaptation. Pavlo verifies that the workflow triggers on `pull_request -> branches:[main]`, runs with `permissions: contents: read`, and uses the SHA-pinned checkout with `persist-credentials: false`.

**Resolution:** Both repos now enforce architecture boundaries the same way. Pavlo documents in the README how to add a justified exception so future contributors do not silently disable rules.

**Reveals requirements for:** version/tooling parity (FR1, NFR8, NFR10), the Makefile target and aggregate wiring (FR13, FR14), the DIND wrapper (FR15), the dedicated workflow with hardened permissions and pinned checkout (FR16, FR18, FR19), and the documentation including how to add exceptions (FR20, FR22).

---

### Journey Requirements Summary

| Journey | Primary requirements surfaced |
| --- | --- |
| 1 — Accidental cross-feature import | FR7, FR8, FR13, FR16, FR17, FR21 |
| 2 — Circular dependency | FR6, FR16, FR17, NFR4 |
| 3 — PascalCase feature name | FR11, FR12, NFR9 |
| 4 — CRM tooling parity | FR1, FR13, FR14, FR15, FR16, FR18, FR19, FR20, FR22, NFR8, NFR10 |

## Developer Tooling Requirements

### Tooling & Configuration

The toolchain adds `dependency-cruiser ^17.x` (matching CRM's `^17.3.7`) to `devDependencies`, installed via the existing `pnpm@10.6.5` / `make install` flow. A single `.dependency-cruiser.js` CommonJS file (`module.exports = { forbidden: [...], options: {...} }`) declares all rules and analysis options. The options block must: confine analysis to source by setting `doNotFollow.path: ['node_modules']`; enable `detectProcessBuiltinModuleCalls`, `tsPreCompilationDeps`, and `combinedDependencies`; resolve the `@/*` alias by pointing `tsConfig.fileName` at `tsconfig.json`; configure `enhancedResolveOptions` (exports/condition names, TS-first extensions, mainFields) so TypeScript and the `bundler` moduleResolution resolve correctly; set `skipAnalysisNotInRules: true` for performance; register `k6` and `k6/http` as built-in modules (the website's load tests import them); and configure `reporterOptions` for the `dot`, `archi`, and `text` reporters with a `node_modules` collapse pattern. The config explicitly does **not** add bun built-ins (the website is node/pnpm, not bun).

### Architecture Boundary Rules

The boundary rules formalize the website's feature-slice architecture at the dependency-graph level. They cover: external code importing a feature only through its `index` barrel; the prohibition on any feature importing any sibling feature; the requirement that the shared UI library (`src/components`) and the foundational shared layers (`src/shared`, `src/config`, `src/hooks`, `src/utils`, `src/lib`, `src/providers`, `src/types`, `src/routes`, `src/stores`) never depend on features; the restriction of each feature root to an approved set of subfolders (`api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`); and the lowercase-kebab-case requirement on feature directory names. All boundary rules carry severity `error`.

### Generic Hygiene Rules

Ported from CRM and adapted: `no-circular` (error — closes the `import/no-cycle` gap), `no-orphans` (error, with a comprehensive `pathNot` allowlist covering dot-files, `*.d.ts`, config files, `__mocks__`, Next.js `pages/` entrypoints, Storybook, coverage and report output directories), `no-deprecated-core` (warn), `not-to-deprecated` (warn), `no-non-package-json` (error), `not-to-unresolvable` (error), `no-duplicate-dep-types` (warn), `not-to-test` (error — production code must not import test folders), `not-to-spec` (error — nothing imports `.spec`/`.test` files), and `not-to-dev-dep` (error — `src` runtime code must not import devDependencies).

### Local Developer Workflow

A `make lint-deps` target runs `dependency-cruiser` over `src` and `tests` using `.dependency-cruiser.js`, invoked through the repository's `PNPM_EXEC` wrapper so it works both inside the dev Docker container (default) and directly on the CI runner (`CI=1`). The target is added to the `lint` aggregate so `make lint` runs it alongside ESLint, TypeScript, and markdownlint. A DIND wrapper `run-deps-lint-tests-dind` mirrors the existing `run-eslint-tests-dind` pattern for in-container parity.

### CI Enforcement

A dedicated `.github/workflows/dependency-cruiser.yml` workflow triggers on `pull_request -> branches:[main]`, declares `permissions: contents: read`, checks out with a SHA-pinned action and `persist-credentials: false`, sets up Node via `${{ vars.NODE_VERSION }}`, installs `pnpm@10.6.5` with caching, runs `make install`, and then `make lint-deps CI=1`. The workflow fails the build (non-zero exit) on any `error`-severity violation.

### Documentation

The README gains a "Dependency Cruiser / Architecture rules" section that lists each rule and its intent, documents `make lint-deps` usage (local and CI), and explains how to add a justified, scoped exception to the config rather than disabling enforcement wholesale.

## Project Scoping & Phased Development

### MVP Strategy

The MVP is the complete, working, CI-enforced gate as described in the issue's acceptance criteria. Because this is additive developer tooling with a low blast radius and a graph that is already clean, the entire deliverable fits comfortably in a single phase — there is little value in shipping a partial gate (a config without CI enforcement provides no guarantee; CI enforcement without a local script frustrates contributors). The MVP therefore delivers config + local script + CI workflow + docs together.

### MVP Feature Set (Phase 1)

1. `dependency-cruiser ^17.x` added to `devDependencies`.
2. `.dependency-cruiser.js` with all generic-hygiene and architecture-boundary rules and the full options block (including the kebab-case feature-name rule and the documented omission of `no-uppercase-paths`).
3. `make lint-deps` target plus aggregation into `make lint`, plus the `run-deps-lint-tests-dind` wrapper.
4. Dedicated `.github/workflows/dependency-cruiser.yml` that auto-runs on PRs to `main` and fails on violations.
5. README "Dependency Cruiser / Architecture rules" section including how to add exceptions.

### Critical Scoping Decisions

- **Dedicated workflow vs. riding the existing lint gate.** Because `lint-deps` is in the `lint` aggregate, it would already run inside `static-testing.yml` (`make lint`). However, we **recommend a dedicated workflow** for two reasons: parity with CRM (which has its own `dependency-cruiser.yml`), and isolated failure reporting (a dependency-cruiser violation surfaces as its own failed check rather than being buried inside the omnibus lint job). Both mechanisms coexist safely; the dedicated workflow is the authoritative gate.
- **Deliberate deviation from CRM: drop `no-uppercase-paths`.** CRM forces all paths lowercase. The website's shared and feature component directories are PascalCase by convention (`UiButton`, `AboutUs`). Porting that rule would generate hundreds of false positives. Lowercase enforcement is scoped to feature directory names only (`src-feature-name-kebab-case`). This trade-off is captured as FR12 and must be documented.
- **Scope of analysis.** The cruise targets `src` and `tests`. The `pages/`, `.storybook/`, and various config files are not orphan-cruised as application code (they are entrypoints), which is why the `no-orphans` `pathNot` allowlist must enumerate them.

### Delivery Strategy

Ship as one PR against `main`. The PR is self-validating: the new CI workflow runs against the PR itself and must pass (the graph is clean today), demonstrating the gate is green on introduction. Because no `src/` files change, there is no behavioral risk to the application.

### Post-MVP Features (Phase 2)

- Emit and archive a dependency graph visualization (`dot`/`archi` reporter output) as a CI artifact for architecture review.
- Add an `--output-type err-long` or HTML report for richer local diagnostics.
- Consider a pre-commit hook (Husky) running `make lint-deps` for faster feedback before push.

### Vision (Phase 3)

- Extend boundary rules as new shared layers graduate from reserved-empty (`hooks`, `utils`, `lib`, `providers`, `types`, `routes`, `stores`) to populated, codifying their allowed dependents.
- Use the archi reporter to publish a living architecture diagram in the docs site.
- Unify the CRM and website dependency-cruiser configs behind a shared preset where the generic-hygiene rules overlap.

### Risk Mitigation

- **Risk: false positives breaking CI on day one.** Mitigated by scoping lowercase enforcement to feature names, by the comprehensive `no-orphans` allowlist, and by validating the config with a dry run against current `main` before merge (graph is clean → expect zero violations).
- **Risk: alias resolution failures (`@/*`).** Mitigated by pointing `tsConfig.fileName` at `tsconfig.json` and configuring `enhancedResolveOptions` for TS-first resolution.
- **Risk: k6 load-test imports flagged as unresolvable.** Mitigated by registering `k6`/`k6/http` as built-in modules.
- **Risk: drift from CRM tooling.** Mitigated by mirroring CRM's version (`^17.x`), Makefile conventions, and workflow shape.

## Functional Requirements

### Tooling & Configuration

- FR1: The repository can declare `dependency-cruiser ^17.x` as a devDependency installed through the existing `pnpm@10.6.5` / `make install` flow, matching the CRM sister repo's major version.
- FR2: A `.dependency-cruiser.js` CommonJS configuration file can define a `forbidden` rule array and an `options` block that together drive all architecture and hygiene checks.
- FR3: The configuration can resolve the `@/*` path alias and TypeScript `bundler` module resolution by referencing `tsconfig.json` and configuring `enhancedResolveOptions` (TS-first extensions, exports/condition names, mainFields).
- FR4: The configuration can confine analysis to source code by excluding `node_modules` from traversal and enabling `skipAnalysisNotInRules` for performance.
- FR5: The configuration can recognize `k6` and `k6/http` as built-in modules so load-test imports are not reported as unresolvable, while deliberately not registering bun built-ins.

### Architecture Boundary Rules

- FR6: The configuration can fail the build on any circular dependency (`no-circular`, severity error), closing the gap left by the unconfigured ESLint `import/no-cycle` rule.
- FR7: The configuration can require that code outside a feature import that feature only through its public `index` barrel (`features-import-via-public-api`, severity error), formalizing the existing ESLint `no-restricted-imports` `@/features/*/*` rule at the dependency-graph level.
- FR8: The configuration can forbid any feature from importing any sibling feature at all (`no-cross-feature-imports`, severity error).
- FR9: The configuration can forbid the shared UI library (`src/components`) from depending on any feature (`no-shared-ui-to-features`, severity error).
- FR10: The configuration can forbid the foundational shared layers (`src/shared`, `src/config`, `src/hooks`, `src/utils`, `src/lib`, `src/providers`, `src/types`, `src/routes`, `src/stores`) from depending on any feature (`no-shared-layers-to-features`, severity error).
- FR11: The configuration can require feature directory names to be lowercase kebab-case (`src-feature-name-kebab-case`, severity error). **This rule is explicitly mandated by the stakeholder.**
- FR12: The configuration can scope lowercase-path enforcement to feature directory names only and deliberately omit CRM's global `no-uppercase-paths` rule, so PascalCase component directories (`UiButton`, `AboutUs`) do not produce false positives. **This deviation from CRM must be documented as an explicit decision.**
- FR13a: The configuration can restrict a feature root to an approved set of subfolders — `api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils` — and flag any other top-level folder inside a feature (`feature-allowed-folders`, severity error).

### Hygiene Rules

- FR12a: The configuration can flag orphaned (unused) modules (`no-orphans`, severity error) while exempting dot-files, `*.d.ts`, config files (babel/webpack/commitlint/stryker/jest/lighthouse, `next.config.js`, `i18n.js`, etc.), `__mocks__`, Next.js `pages/` entrypoints, Storybook, coverage, and report-output directories via a `pathNot` allowlist.
- FR12b: The configuration can warn on imports of deprecated core modules and deprecated npm packages (`no-deprecated-core`, `not-to-deprecated`, severity warn).
- FR12c: The configuration can error on dependencies that are unresolvable or absent from `package.json` (`not-to-unresolvable`, `no-non-package-json`, severity error), excluding `http(s)://` URLs.
- FR12d: The configuration can warn when a dependency is declared under more than one dependency type (`no-duplicate-dep-types`, severity warn), excluding type-only declarations.
- FR12e: The configuration can forbid production code from importing test folders (`not-to-test`) and from importing `.spec`/`.test` files (`not-to-spec`), both severity error.
- FR12f: The configuration can forbid `src` runtime code from importing devDependencies (`not-to-dev-dep`, severity error), excluding spec/test files and `@types` packages.

### Local Developer Workflow

- FR13: A `make lint-deps` target can run dependency-cruiser over `src` and `tests` using `.dependency-cruiser.js`, invoked through the `PNPM_EXEC` wrapper so it runs inside the dev Docker container by default and directly on the runner when `CI=1`.
- FR14: The `lint` aggregate target can include `lint-deps` (`lint: lint-next lint-tsc lint-md lint-deps`) so `make lint` runs all four linters in sequence, and `make help` can list `lint-deps` via its trailing `##` description comment.
- FR15: A DIND wrapper `run-deps-lint-tests-dind` can run `make lint-deps CI=1` inside a test container, mirroring the existing `run-eslint-tests-dind` pattern.

### CI Enforcement

- FR16: A dedicated `.github/workflows/dependency-cruiser.yml` workflow can run dependency-cruiser automatically on every `pull_request` targeting `branches: [main]`.
- FR17: The CI workflow can fail the pull request (non-zero exit / failed required check) whenever any `error`-severity violation is detected.
- FR18: The CI workflow can pin the Node version to the `${{ vars.NODE_VERSION }}` repository variable, install `pnpm@10.6.5`, cache pnpm dependencies, and run `make install` before `make lint-deps CI=1`, consistent with `static-testing.yml`.
- FR19: The CI workflow can declare least-privilege `permissions: contents: read` and check out the repository with a SHA-pinned action and `persist-credentials: false`.
- FR23: The design can document, and recommend against relying solely on, the alternative of riding the existing `static-testing.yml` `make lint` gate; the dedicated workflow is the authoritative gate for CRM parity and isolated failure reporting (while both coexist safely).

### Documentation

- FR20: The README can include a "Dependency Cruiser / Architecture rules" section listing every rule and its intent.
- FR21: The tooling can produce human-readable violation output that names the violated rule, the source module, and the target module, so a developer can act on it without consulting the config.
- FR22: The README can document `make lint-deps` usage (local and CI) and explain how to add a justified, scoped exception to the configuration rather than disabling rules wholesale.

## Traceability Matrix

| FR | Epic | Stories | Coverage |
| --- | --- | --- | --- |
| FR1 | Epic 1: Tooling & Configuration | 1.1 | dependency-cruiser ^17.x devDependency |
| FR2 | Epic 1: Tooling & Configuration | 1.2 | `.dependency-cruiser.js` skeleton (forbidden + options) |
| FR3 | Epic 1: Tooling & Configuration | 1.2 | alias / TS resolution options |
| FR4 | Epic 1: Tooling & Configuration | 1.2 | analysis-scope / performance options |
| FR5 | Epic 1: Tooling & Configuration | 1.2 | k6 built-in modules; no bun |
| FR6 | Epic 2: Architecture Boundary Rules | 2.1 | no-circular |
| FR7 | Epic 2: Architecture Boundary Rules | 2.2 | features-import-via-public-api |
| FR8 | Epic 2: Architecture Boundary Rules | 2.2 | no-cross-feature-imports |
| FR9 | Epic 2: Architecture Boundary Rules | 2.3 | no-shared-ui-to-features |
| FR10 | Epic 2: Architecture Boundary Rules | 2.3 | no-shared-layers-to-features |
| FR11 | Epic 2: Architecture Boundary Rules | 2.4 | src-feature-name-kebab-case (stakeholder-mandated) |
| FR12 | Epic 2: Architecture Boundary Rules | 2.4 | omit no-uppercase-paths; scope to feature names |
| FR13a | Epic 2: Architecture Boundary Rules | 2.5 | feature-allowed-folders |
| FR12a | Epic 3: Hygiene Rules | 3.1 | no-orphans + allowlist |
| FR12b | Epic 3: Hygiene Rules | 3.2 | no-deprecated-core, not-to-deprecated |
| FR12c | Epic 3: Hygiene Rules | 3.2 | not-to-unresolvable, no-non-package-json |
| FR12d | Epic 3: Hygiene Rules | 3.2 | no-duplicate-dep-types |
| FR12e | Epic 3: Hygiene Rules | 3.3 | not-to-test, not-to-spec |
| FR12f | Epic 3: Hygiene Rules | 3.3 | not-to-dev-dep |
| FR13 | Epic 4: Local Developer Workflow | 4.1 | make lint-deps target |
| FR14 | Epic 4: Local Developer Workflow | 4.1 | lint aggregate + make help |
| FR15 | Epic 4: Local Developer Workflow | 4.2 | run-deps-lint-tests-dind wrapper |
| FR16 | Epic 5: CI Enforcement | 5.1 | dedicated workflow auto-runs on PR->main |
| FR17 | Epic 5: CI Enforcement | 5.1 | fails on violations |
| FR18 | Epic 5: CI Enforcement | 5.1 | node version var, pnpm, cache, make install |
| FR19 | Epic 5: CI Enforcement | 5.2 | hardened permissions + pinned checkout |
| FR23 | Epic 5: CI Enforcement | 5.2 | document alternative; recommend dedicated workflow |
| FR20 | Epic 6: Documentation | 6.1 | README rules section |
| FR21 | Epic 6: Documentation | 6.1 | actionable violation output |
| FR22 | Epic 6: Documentation | 6.1 | usage + how to add exceptions |

## Non-Functional Requirements

### Performance

- NFR1: A full cruise of `src` and `tests` must complete within the existing static-testing time budget — target under ~30 seconds on the CI runner, comparable to the ESLint step — aided by `skipAnalysisNotInRules: true` and excluding `node_modules` from traversal.
- NFR2: The analysis must not require building the application or starting any service; it operates on the source graph only, keeping the CI job lightweight.

### Reliability

- NFR3: The check must be deterministic: the same commit produces the same pass/fail result on every run, with no flakiness.
- NFR4: Graph analysis (cycles, orphans, boundaries) must be reproducible across local and CI environments given identical source and config.
- NFR5: The check must run with no network access required at analysis time (all dependencies already installed by `make install`), avoiding external-service flakiness.

### Failure Behavior

- NFR6: Any `error`-severity violation must cause a non-zero exit code and a failed CI check; `warn`-severity rules must surface in output without failing the build.
- NFR7: Violation output must be actionable — naming the rule, source, and target — so failures are self-explanatory in the CI log.

### Compatibility

- NFR8: The tooling must work with Node `>=20` pinned via `${{ vars.NODE_VERSION }}`, the `pnpm@10.6.5` package manager, and the Makefile `CI=1` / `PNPM_EXEC` execution pattern, both inside the dev Docker container and directly on the CI runner.
- NFR9: On the current `main`, the gate must report **zero false positives** — there are zero cross-feature imports and no cycles today, and PascalCase component directories must not be flagged (lowercase enforcement is scoped to feature names only).
- NFR10: The configuration must remain compatible with the website's `next.config.js` (`output: 'export'`, `transpilePackages`), TypeScript `bundler` moduleResolution, and the single `@/*` alias, resolving them correctly.

### Consistency

- NFR11: The tooling must mirror the CRM sister-repo pattern — same dependency-cruiser major version (`^17.x`), same Makefile integration conventions (`BIN_DIR`, per-tool `*_BIN` var, aggregate `lint` target, DIND wrapper), and same dedicated-workflow shape — so engineers moving between repos encounter a consistent experience.
- NFR12: Naming and structure of the new target, wrapper, workflow, and config must follow the website's existing conventions (kebab-case feature directories, PascalCase component directories, camelCase helper/hook files, `package.json` with no `scripts` section — all task-running via the Makefile).
