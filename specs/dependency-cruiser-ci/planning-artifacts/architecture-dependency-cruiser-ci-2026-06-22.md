---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
lastStep: 8
status: complete
completedAt: '2026-06-22'
inputDocuments:
  - specs/dependency-cruiser-ci/planning-artifacts/prd-dependency-cruiser-ci-2026-06-22.md
workflowType: architecture
project_name: website
user_name: BMad
date: '2026-06-22'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

This architecture realizes the PRD `prd-dependency-cruiser-ci-2026-06-22.md` for the VilnaCRM **website** repository: introducing `dependency-cruiser` as a CI-enforced architecture-governance gate adapted to the website's **feature-based** structure (there is no `src/modules` layer, unlike the CRM sister repo).

**Functional Requirements:**

- **Tooling & Configuration:** FR1 (`dependency-cruiser ^17.x` devDependency via `pnpm@10.6.5` / `make install`), FR2 (`.dependency-cruiser.js` CommonJS `forbidden` + `options`), FR3 (`@/*` alias + `bundler` resolution via `tsConfig.fileName` + `enhancedResolveOptions`), FR4 (confine to source, `skipAnalysisNotInRules`), FR5 (register `k6`/`k6/http`, no bun built-ins).
- **Architecture Boundary Rules:** FR6 (`no-circular`), FR7 (`features-import-via-public-api`), FR8 (`no-cross-feature-imports`), FR9 (`no-shared-ui-to-features`), FR10 (`no-shared-layers-to-features`), FR11 (`src-feature-name-kebab-case` — **stakeholder-mandated**), FR12 (omit CRM `no-uppercase-paths`; scope lowercase to feature names — **deliberate deviation, must be documented**), FR13a (`feature-allowed-folders`).
- **Hygiene Rules:** FR12a (`no-orphans` + allowlist), FR12b (`no-deprecated-core`, `not-to-deprecated`), FR12c (`not-to-unresolvable`, `no-non-package-json`), FR12d (`no-duplicate-dep-types`), FR12e (`not-to-test`, `not-to-spec`), FR12f (`not-to-dev-dep`).
- **Local Developer Workflow:** FR13 (`make lint-deps` over `src`/`tests` via `PNPM_EXEC`), FR14 (`lint` aggregate + `make help`), FR15 (`run-deps-lint-tests-dind` wrapper).
- **CI Enforcement:** FR16 (dedicated `dependency-cruiser.yml` on `pull_request -> branches:[main]`), FR17 (fail on `error` violations), FR18 (`${{ vars.NODE_VERSION }}`, `pnpm@10.6.5`, cache, `make install`, `make lint-deps CI=1`), FR19 (`permissions: contents: read`, SHA-pinned checkout, `persist-credentials: false`), FR23 (document alternative; recommend dedicated workflow).
- **Documentation:** FR20 (README rules section), FR21 (actionable violation output), FR22 (usage + how to add exceptions).

**Non-Functional Requirements:**

- **Performance:** NFR1 (< ~30 s cruise of `src`/`tests`, comparable to ESLint), NFR2 (no app build / no service start).
- **Reliability:** NFR3 (deterministic), NFR4 (reproducible local + CI), NFR5 (no network at analysis time).
- **Failure Behavior:** NFR6 (`error` → non-zero exit + failed check; `warn` surfaces without failing), NFR7 (actionable output naming rule/source/target).
- **Compatibility:** NFR8 (Node `>=20`, `pnpm@10.6.5`, `CI=1` / `PNPM_EXEC`), NFR9 (zero false positives on `main`; PascalCase component dirs not flagged), NFR10 (compatible with `next.config.js` `output:'export'` / `transpilePackages`, `bundler` resolution, single `@/*` alias).
- **Consistency:** NFR11 (mirror CRM major version + Makefile conventions + workflow shape), NFR12 (follow website naming/structure conventions; no `package.json` `scripts` — all task-running via Makefile).

**Scale & Complexity:** Low blast radius, medium complexity. The deliverable is one config file plus Makefile and CI wiring; complexity is concentrated in correct regex authoring and resolver options, not code volume. No `src/` changes. The dependency graph is clean today (zero cross-feature imports, no cycles), so the gate is green on introduction.

### Architectural Principles

1. **Additive, zero-blast-radius governance.** The gate observes the import graph; it does not change application behavior. No file under `src/` is touched. A clean graph today means a green gate on day one (NFR9).
2. **Graph-level invariants over per-file heuristics.** dependency-cruiser enforces invariants ESLint cannot reach: cycles (`import/no-cycle` is unconfigured today), cross-feature coupling across re-exports/dynamic paths, orphans, dev-dep leakage (FR6–FR10, FR12f).
3. **Adapt, do not transcribe, the CRM config.** Every CRM rule is re-evaluated against the website's feature-based structure. Module-layer assumptions (`src/modules/*/features/*`) are dropped; boundary rules are re-expressed against `src/features/<feature>/`, `src/components/`, and the foundational shared layers.
4. **Zero-false-positive on existing conventions.** The website uses PascalCase component directory names (`UiButton`, `AboutUs`, `AppTheme`) by established convention. CRM's global `no-uppercase-paths` rule is therefore **deliberately omitted**; lowercase enforcement is scoped to feature directory names only (FR11, FR12, NFR9).
5. **CRM tooling parity.** Same major version (`^17.x`), same Makefile conventions (`BIN_DIR`, per-tool `*_BIN`, `PNPM_EXEC`, `CI=1`, DIND wrapper), same dedicated-workflow shape (NFR11).
6. **Makefile is the single task runner.** `package.json` has no `scripts` section; the tool is invoked through `$(PNPM_EXEC) $(DEPCRUISE_BIN)` and never via npm scripts (NFR12).

### Technical Constraints & Dependencies

- **Stack (observed):** Next.js (pages-router; `next.config.js` `output:'export'`, `transpilePackages:['@faker-js/faker']`, custom `splitChunks`), React 18.3, TypeScript with `moduleResolution:'bundler'`, MUI v7 + Emotion, Apollo + GraphQL, i18next, Zustand, react-hook-form.
- **tsconfig (observed):** `paths` has exactly two aliases — `@/*` -> `./src/*` and `@swagger/global` -> a single SCSS file. `include` covers `pages/**/*`, `src/**/*`, `./scripts`, `next-env.d.ts`, plus broad `**/*.ts(x)` globs. The cruiser must point `tsConfig.fileName` at `tsconfig.json` so `@/*` resolves (FR3, NFR10).
- **Package manager / Node:** `pnpm@10.6.5`, Node `>=20` pinned via `${{ vars.NODE_VERSION }}` (NFR8).
- **Makefile (observed):** `BIN_DIR = ./node_modules/.bin`; per-tool BIN vars (`ESLINT_BIN`, `TS_BIN`, `MARKDOWNLINT_BIN`); `CI ?= 0` with `1/true/TRUE` normalized to `1`; when `CI=1`, `PNPM_EXEC = pnpm` (runs directly on the runner) else `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`); `.DEFAULT_GOAL = help`; `make help` lists targets carrying a trailing `## description`; aggregate is `lint: lint-next lint-tsc lint-md`; individual lint targets call `$(PNPM_EXEC) $(TOOL_BIN)`; DIND wrappers exist (`run-eslint-tests-dind -> make lint-next CI=1`).
- **CI (observed):** `static-testing.yml` runs `make install` then `make lint` on `pull_request -> branches:[main]`, `env: CI: 1`, `setup-node` with `node-version: ${{ vars.NODE_VERSION }}`, pnpm cached via `actions/cache`. 18 workflows total, all on `pull_request -> branches:[main]`.
- **ESLint (observed):** `no-restricted-imports` for `@/features/*/*` (forbids deep import past a feature barrel) and `import/order`; `import/no-cycle` is **NOT** configured (the real gap this work closes); `import/no-unresolved` off.
- **External tool dependency:** `dependency-cruiser ^17.x` added to `devDependencies` (FR1).

### Cross-Cutting Concerns Identified

- **Alias resolution (`@/*`).** Every internal import uses `@/...`. If the resolver does not read `tsconfig.json`, all internal edges become unresolvable and `not-to-unresolvable` floods. Mitigated by `tsConfig.fileName` + `enhancedResolveOptions` (FR3, NFR10).
- **PascalCase paths.** A global lowercase rule would emit hundreds of false positives. Resolved by omitting `no-uppercase-paths` and scoping lowercase to feature names (FR11, FR12, NFR9).
- **k6 imports.** Load tests `import` `k6` / `k6/http` (resolved at runtime by the k6 binary, not by Node). Registered as built-in modules so they are not flagged unresolvable (FR5).
- **Entrypoints vs. orphans.** `pages/`, `.storybook/`, config files, and report-output dirs are legitimate entrypoints/outputs, not orphans. The `no-orphans` `pathNot` allowlist must enumerate them (FR12a).
- **Determinism / no network.** Analysis runs on the already-installed graph with no service start (NFR2, NFR3, NFR5).
- **Failure semantics.** `error` fails the build; `warn` informs only (NFR6).

---

## Starter Template Evaluation

### Primary Technology Domain

Developer tooling / CI quality gate operating by **static analysis of the TypeScript/JavaScript import graph**. There is no application runtime, UI, or data store in scope — the "system" is a configuration file plus build wiring.

### Existing Conventions (Pre-Made Decisions)

The brownfield codebase has already decided the following; the architecture must conform, not relitigate:

- **Feature slices:** `src/features/<feature>/` with a public `index.ts` barrel (`landing/index.ts` exports `LandingComponent`; `swagger/index.ts` exports `Swagger`). Existing slices: `landing` (fully built), `swagger`, plus i18n-only stubs `documentation/`, `example/`, `registration/`.
- **Feature directory names:** lowercase **kebab-case** (`landing`, `swagger`, `registration`).
- **Shared UI library:** `src/components/` with **PascalCase** directories (`UiButton`, `UiInput`, `AppTheme`, `Layout`, ...) + `index.ts` barrel + `Types.d.ts`.
- **Foundational shared layers:** `src/shared/`, `src/config/`; reserved-but-empty `src/hooks`, `src/utils`, `src/lib`, `src/providers`, `src/types`, `src/routes`, `src/stores` (each holds only a `.gitignore` placeholder today).
- **Helper/hook files:** camelCase `.ts`.
- **Single general alias:** `@/*` -> `./src/*`.
- **Zero cross-feature imports today.**
- **No `package.json` `scripts`:** all task-running via the Makefile.

### Foundation Options Considered

| Option | Description | Verdict |
| --- | --- | --- |
| A. Verbatim CRM `.dependency-cruiser.js` | Copy CRM's ~35-rule module-based config unchanged | **Rejected** — assumes `src/modules/*/features/*`; `no-uppercase-paths` would flood PascalCase dirs; rules reference a non-existent layer. |
| B. ESLint-plugin-import only (`import/no-cycle` etc.) | Extend ESLint instead of adding a tool | **Rejected** — per-file linter cannot express graph boundaries (cross-feature, orphans, dev-dep leakage) and breaks CRM parity. |
| C. CRM config **adapted** to the feature structure, PascalCase-safe | Port generic hygiene rules; re-express boundary rules against `src/features`, `src/components`, shared layers; drop `no-uppercase-paths`; add `src-feature-name-kebab-case` | **Selected** — closes the real gaps, mirrors CRM tooling, zero false positives on `main`. |

### Selected Foundation

**Option C.** A single CommonJS `.dependency-cruiser.js` (`module.exports = { forbidden: [...16 rules...], options: {...} }`) modeled on CRM but adapted to the website feature-based structure and made PascalCase-safe. Wired via `make lint-deps` into the `lint` aggregate, enforced by a dedicated `.github/workflows/dependency-cruiser.yml`, documented in the README.

### Initialization Command (brownfield — no new init)

This is a brownfield repository. There is **no scaffolding/init step** and `depcruise --init` is **not** run (its generated config does not match the feature-based structure or PascalCase convention). The complete config is authored by hand from the design in this document. The only dependency install is the additive devDependency:

```bash
# Performed during implementation only (not in this planning session):
pnpm add -D dependency-cruiser@^17    # FR1 — matches CRM ^17.3.7 major
make install                          # refresh node_modules / lockfile via existing flow
```

> Planning-artifacts-only constraint: this session does NOT create `.dependency-cruiser.js`, edit the Makefile, `package.json`, or any workflow, or touch `src/`. Everything below is the authoritative description a future implementation story will apply.

### Blast-Radius Inventory

| Surface | Touched? | Effect |
| --- | --- | --- |
| `src/**` | No | Untouched. No behavioral change. |
| `pages/**`, `public/**`, `styles/**` | No | Untouched. |
| `package.json` | Yes (devDeps only) | Adds `dependency-cruiser ^17.x`; no `scripts` added. |
| `Makefile` | Yes | Adds `DEPCRUISE_BIN`, `lint-deps`, `run-deps-lint-tests-dind`; extends `lint` aggregate. |
| `.dependency-cruiser.js` (root) | Yes (new) | New config; inert until `make lint-deps` runs. |
| `.github/workflows/dependency-cruiser.yml` | Yes (new) | New required-check workflow. |
| `README.md` | Yes | Adds "Dependency Cruiser / Architecture rules" section. |
| Application runtime / bundle | No | Cruiser never runs in `next build`. |

---

## Core Architectural Decisions

### Decision Priority Analysis

Decisions are ordered by dependency: the config file (AD-1) is the substrate; resolver options (AD-2) make the config analyzable at all; the boundary-rule design (AD-3) is the core contribution; the PascalCase deviation (AD-4) is the headline trade-off; analysis scope (AD-5) prevents false positives; Makefile wiring (AD-6) and the dedicated workflow (AD-7) make it enforceable; documentation (AD-8) makes it maintainable.

### AD-1: Single CommonJS `.dependency-cruiser.js` with `forbidden` + `options`

**Decision:** Author one root-level `.dependency-cruiser.js` as `module.exports = { forbidden: [...16 rules...], options: {...} }`. CommonJS (not ESM/`.mjs`/`.ts`) for direct, zero-config consumption by the `depcruise` binary and parity with CRM. (FR2)

**Rationale:** A single file is the simplest enforceable unit, mirrors CRM, requires no transpile step, and keeps the rule set reviewable in one place. CommonJS sidesteps ESM loader edge cases in the tool.

**Files affected:**

```text
.dependency-cruiser.js   [ADD] repository root
```

### AD-2: Resolver options pinned to `tsconfig.json` + `enhancedResolveOptions` (close the `@/*` / `bundler` gap)

**Decision:** In `options`, set `tsConfig.fileName: 'tsconfig.json'`, `tsPreCompilationDeps: true`, `combinedDependencies: true`, `detectProcessBuiltinModuleCalls: true`, and an `enhancedResolveOptions` block with `exportsFields:['exports']`, `conditionNames:['import','require','node','default','types']`, TS-first `extensions:['.ts','.tsx','.d.ts','.js','.jsx']`, and `mainFields:['main','types','typings']`. (FR3, NFR10)

**Rationale:** Every internal import is `@/...`. Without reading `tsconfig.json` the resolver cannot follow these edges and `not-to-unresolvable` would fire on nearly every file. TS-first extensions and exports/condition names make `bundler` moduleResolution and modern packages (MUI v7, Emotion, Apollo) resolve correctly. `tsPreCompilationDeps` captures type-only edges so cycles and boundaries hidden behind `import type` are still seen.

**Files affected:**

```text
.dependency-cruiser.js   [MODIFY in-file: options.tsConfig / options.enhancedResolveOptions]
```

### AD-3: Feature-based architecture boundary rules (the core contribution)

**Decision:** Express six boundary rules directly against the website's layers — no `src/modules`:

- **FR7 `features-import-via-public-api`** (error): code outside a feature may import a feature only through its `index` barrel. `from {path:'^src/', pathNot:'^src/features/[^/]+/'}` `to {path:'^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+'}`. Formalizes ESLint `no-restricted-imports ['@/features/*/*']` at the graph level (catches re-exported / dynamic deep imports ESLint misses).
- **FR8 `no-cross-feature-imports`** (error): a feature must not import a sibling feature at all. Uses a capture group on the source feature and a negative lookahead on the target: `from {path:'^src/features/([^/]+)/'}` `to {path:'^src/features/(?!$1/)'}`.
- **FR9 `no-shared-ui-to-features`** (error): `src/components/` must stay feature-agnostic — `from {path:'^src/components/'}` `to {path:'^src/features/'}`.
- **FR10 `no-shared-layers-to-features`** (error): foundational layers must not depend on features — `from {path:'^src/(shared|hooks|utils|lib|providers|types|config|routes|stores)/'}` `to {path:'^src/features/'}`.
- **FR13a `feature-allowed-folders`** (error): a feature root may only contain approved subfolders (`api|assets|components|constants|helpers|hooks|i18n|routes|types|utils`); any other top-level folder is flagged via `from {path:'^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/'}`.
- **FR6 `no-circular`** (error): closes the unconfigured `import/no-cycle` gap — `to {circular:true}`.

**Rationale:** These rules encode the feature-slice contract the codebase already follows by discipline, making drift a CI failure rather than a review-time catch. The capture-group sibling rule (`$1`) is the precise feature-based analogue of CRM's module sibling rule, expressed one layer shallower because there is no module nesting.

**Files affected:**

```text
.dependency-cruiser.js   [MODIFY in-file: forbidden[] boundary rules]
```

### AD-4: Deliberate deviation from CRM — omit `no-uppercase-paths`, scope lowercase to feature names (FR11 + FR12)

**Decision:** **Do NOT port CRM's `no-uppercase-paths` rule.** CRM forces every path lowercase; the website's shared UI and feature *component* directories are PascalCase by established convention (`UiButton`, `UiInput`, `AppTheme`, `AboutUs`). Porting it verbatim would emit **hundreds** of false positives against valid code and violate NFR9. Instead, lowercase enforcement is **scoped to feature directory names only** via a single dedicated rule:

- **FR11 `src-feature-name-kebab-case`** (error) — **STAKEHOLDER-MANDATED, CALLED OUT PROMINENTLY**: a feature directory name immediately under `src/features/` must be lowercase kebab-case. `from {path:'^src/features/(?![a-z0-9-]+/)[^/]+/'}` `to {}`. The negative lookahead `(?![a-z0-9-]+/)` matches any first-segment feature name that is NOT pure `[a-z0-9-]`, so `src/features/UserOnboarding/...` fails while `src/features/user-onboarding/...` and PascalCase *component* dirs nested inside a feature (`src/features/landing/components/AboutUs/...`) pass untouched.

**Rationale:** This is the headline trade-off of the website adaptation. Global lowercase enforcement is incompatible with the codebase's PascalCase component convention; the only path-casing invariant the stakeholder actually requires is on feature *slice* names. Scoping the rule to the first path segment under `src/features/` delivers exactly that requirement with zero collateral false positives (NFR9). The deviation is explicit and recorded as FR12 so future maintainers do not "restore" the CRM rule and break the build.

**Files affected:**

```text
.dependency-cruiser.js   [MODIFY in-file: forbidden[] — ADD src-feature-name-kebab-case; OMIT no-uppercase-paths]
```

### AD-5: Analysis scope and `no-orphans` allowlist (zero false positives, performance)

**Decision:** Cruise `src` and `tests` only. In `options`: `doNotFollow.path:['node_modules']` and `skipAnalysisNotInRules:true` (FR4, NFR1). The `no-orphans` rule (error) carries a comprehensive `pathNot` allowlist exempting dot-files, `*.d.ts`, `tsconfig.json`, `(babel|webpack).config.*`, `(commitlint|stryker).config.*`, `__mocks__`, `next.config.js`, `jest*.config.*`, `babel-jest.config.js`, `i18n.js`, `mutation.js`, `checkNodeVersion.js`, `lighthouserc.*.js`, Next.js `^pages/` entrypoints, `^.storybook/`, and the output dirs `^coverage/`, `^test-results/`, `^playwright-report/`, `^storybook-static/`. (FR12a)

**Rationale:** Entrypoints and generated output are not orphans; without the allowlist `no-orphans` would fire spuriously and violate NFR9. `skipAnalysisNotInRules` + excluding `node_modules` keep the cruise under the ~30 s budget (NFR1) with no app build (NFR2) and no network (NFR5). `k6`/`k6/http` are registered as built-in modules so load-test imports are not unresolvable (FR5); bun built-ins are deliberately NOT added (website is node/pnpm).

**Files affected:**

```text
.dependency-cruiser.js   [MODIFY in-file: options.doNotFollow / options.skipAnalysisNotInRules / options.builtInModules; forbidden[] no-orphans]
```

### AD-6: Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper

**Decision:** Add `DEPCRUISE_BIN = $(BIN_DIR)/depcruise`; a `lint-deps` target that runs `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js`; extend the aggregate to `lint: lint-next lint-tsc lint-md lint-deps`; add `run-deps-lint-tests-dind -> make lint-deps CI=1` mirroring `run-eslint-tests-dind`. (FR13, FR14, FR15, NFR8, NFR11, NFR12)

**Rationale:** `PNPM_EXEC` gives the exact dual-mode behavior of every other lint target — runs inside the dev Docker container by default, directly on the runner when `CI=1`. The trailing `## description` makes it appear in `make help`. The DIND wrapper preserves in-container parity with the other linters.

**Files affected:**

```text
Makefile   [MODIFY: DEPCRUISE_BIN var; lint-deps target; lint aggregate; run-deps-lint-tests-dind]
```

### AD-7: Dedicated CI workflow `dependency-cruiser.yml` (recommended over riding `static-testing.yml`)

**Decision:** Add a dedicated `.github/workflows/dependency-cruiser.yml` on `pull_request -> branches:[main]` with `permissions: contents: read`, a SHA-pinned `actions/checkout` with `persist-credentials: false`, `setup-node` at `node-version: ${{ vars.NODE_VERSION }}`, pnpm cache, `Install pnpm` (`npm install -g pnpm`), `make install`, then `make lint-deps CI=1`. (FR16, FR17, FR18, FR19)

**Rationale / FR23 alternative:** Because `lint-deps` is in the `lint` aggregate, it would *already* run inside `static-testing.yml` (`make lint`). Both mechanisms coexist safely. We nonetheless **recommend the dedicated workflow** for (a) CRM parity — CRM ships its own `dependency-cruiser.yml` — and (b) **isolated failure reporting**: an architecture violation surfaces as its own failed required check rather than being buried in the omnibus lint job. The dedicated workflow is the **authoritative gate**.

**Files affected:**

```text
.github/workflows/dependency-cruiser.yml   [ADD]
```

### AD-8: README "Dependency Cruiser / Architecture rules" section + exception protocol

**Decision:** Add a README section listing each rule and its intent, documenting `make lint-deps` usage (local + `CI=1`), describing the actionable violation format (rule / source / target), and explaining how to add a **justified, scoped exception** (a narrow `pathNot`/`comment` addition to the specific rule, reviewed in PR) rather than disabling enforcement wholesale. (FR20, FR21, FR22)

**Rationale:** Documentation converts the gate from a roadblock into a self-service tool and prevents silent rule-disabling, preserving long-term integrity.

**Files affected:**

```text
README.md   [MODIFY: add "Dependency Cruiser / Architecture rules" section]
```

### Decision Impact Analysis

| Decision | Enables FRs | Satisfies NFRs | Risk if skipped |
| --- | --- | --- | --- |
| AD-1 Single CJS config | FR2 | NFR11, NFR12 | No enforceable rule substrate. |
| AD-2 Resolver options | FR3 | NFR10 | All `@/*` edges unresolvable → CI floods. |
| AD-3 Boundary rules | FR6–FR10, FR13a | NFR9 | Core governance absent; cycles & coupling slip through. |
| AD-4 Omit uppercase / kebab feature names | FR11, FR12 | NFR9 | Hundreds of false positives on PascalCase dirs; gate red on day one. |
| AD-5 Scope + orphans allowlist | FR4, FR5, FR12a | NFR1, NFR2, NFR5, NFR9 | Spurious orphans; k6 unresolvable; slow cruise. |
| AD-6 Makefile wiring | FR13, FR14, FR15 | NFR8, NFR11, NFR12 | No local run; not in aggregate; no DIND parity. |
| AD-7 Dedicated workflow | FR16, FR17, FR18, FR19, FR23 | NFR3, NFR6, NFR8 | No isolated required check; no CRM parity. |
| AD-8 README | FR20, FR21, FR22 | — | Silent rule-disabling; poor discoverability. |

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

- **Feature directories:** lowercase kebab-case, enforced by `src-feature-name-kebab-case` (FR11).
- **Component directories** (shared and feature-local): PascalCase, NOT enforced lowercase (FR12).
- **Helper/hook files:** camelCase `.ts`.
- **Makefile artifacts:** `DEPCRUISE_BIN` (UPPER_SNAKE var, per existing `*_BIN` convention); `lint-deps` and `run-deps-lint-tests-dind` (kebab-case targets, per existing convention).
- **Workflow file:** `dependency-cruiser.yml` (kebab-case, matching CRM and the 18 existing workflow filenames).
- **Rule names** in the config: kebab-case strings exactly as enumerated (the 16 names listed in Architecture Validation).

### Structure Patterns

- Config lives at repository **root** (`.dependency-cruiser.js`) — the directory `depcruise` discovers by default and where CRM keeps it.
- Cruise targets are exactly `src tests` (the application source tree plus the top-level `tests/` dir). `src/test/*` is also covered because it lives under `src`.
- `forbidden[]` ordering: generic hygiene rules first (rules 1–10), then architecture boundary rules (rules 11–16), matching the PRD enumeration for reviewability.

### Format Patterns

- Each rule is an object `{ name, severity, comment, from, to }`. Every rule carries a `comment` stating intent (drives FR21 actionable output).
- Regexes are JavaScript string/RegExp literals; anchors (`^`) and the kebab lookahead `(?![a-z0-9-]+/)` are mandatory for correctness.
- Severities: `error` for hard boundaries and resolvability; `warn` for deprecation/duplicate-dep-type advisories (NFR6).

### Communication Patterns

- Tool → developer: `text` reporter naming rule, source, target (FR21, NFR7).
- CI → PR: non-zero exit on any `error` violation becomes a failed required check (FR17, NFR6).
- Maintainer → maintainer: exceptions are added as a scoped `pathNot`/`comment` on the specific rule, reviewed in PR (FR22).

### Process Patterns

- Local: `make lint-deps` (container) or `make lint-deps CI=1` (host) before pushing.
- Aggregate: `make lint` runs all four linters in sequence including `lint-deps` (FR14).
- CI: dedicated workflow runs `make install` then `make lint-deps CI=1` on every PR to `main` (FR16, FR18).

### Enforcement Guidelines

**All AI Agents MUST:**

- Keep `.dependency-cruiser.js` as the single source of architecture truth; never duplicate boundary logic into ESLint or ad-hoc scripts.
- Invoke the tool only through the Makefile (`$(PNPM_EXEC) $(DEPCRUISE_BIN)`); never add a `scripts` entry to `package.json` (NFR12).
- Keep `src-feature-name-kebab-case` present (FR11) and keep `no-uppercase-paths` ABSENT (FR12).
- Pin the cruiser to `tsConfig.fileName: 'tsconfig.json'` so `@/*` resolves (FR3).
- Add new shared layers to the `no-shared-layers-to-features` alternation when they graduate from reserved-empty.
- Resolve a violation by fixing the dependency, not by widening a rule; an exception requires a justified, scoped `pathNot` reviewed in PR.

**Anti-Patterns:**

- Re-introducing CRM's global `no-uppercase-paths` (breaks PascalCase dirs — NFR9 violation).
- Pointing the cruise at `node_modules` or omitting `doNotFollow` (NFR1 violation).
- Adding bun built-ins (website is node/pnpm — FR5).
- Disabling a whole rule to silence one violation instead of a scoped exception.
- Adding `dependency-cruiser` invocation to `next build` or any runtime path (it is a static gate only — NFR2).

---

## Project Structure & Boundaries

### Requirements to File Mapping

| Requirement(s) | File / Artifact | Decision |
| --- | --- | --- |
| FR1 | `package.json` (devDependencies) | AD-1 / Init |
| FR2 | `.dependency-cruiser.js` (`module.exports` shape) | AD-1 |
| FR3, NFR10 | `.dependency-cruiser.js` `options.tsConfig` / `enhancedResolveOptions` | AD-2 |
| FR4, FR5, NFR1, NFR2, NFR5 | `.dependency-cruiser.js` `options.doNotFollow` / `skipAnalysisNotInRules` / `builtInModules` | AD-5 |
| FR6 | `.dependency-cruiser.js` `no-circular` | AD-3 |
| FR7 | `.dependency-cruiser.js` `features-import-via-public-api` | AD-3 |
| FR8 | `.dependency-cruiser.js` `no-cross-feature-imports` | AD-3 |
| FR9 | `.dependency-cruiser.js` `no-shared-ui-to-features` | AD-3 |
| FR10 | `.dependency-cruiser.js` `no-shared-layers-to-features` | AD-3 |
| FR11 | `.dependency-cruiser.js` `src-feature-name-kebab-case` | AD-4 |
| FR12, NFR9 | `.dependency-cruiser.js` (omits `no-uppercase-paths`) | AD-4 |
| FR13a | `.dependency-cruiser.js` `feature-allowed-folders` | AD-3 |
| FR12a | `.dependency-cruiser.js` `no-orphans` + allowlist | AD-5 |
| FR12b | `.dependency-cruiser.js` `no-deprecated-core`, `not-to-deprecated` | AD-3/AD-5 |
| FR12c | `.dependency-cruiser.js` `not-to-unresolvable`, `no-non-package-json` | AD-3/AD-5 |
| FR12d | `.dependency-cruiser.js` `no-duplicate-dep-types` | AD-5 |
| FR12e | `.dependency-cruiser.js` `not-to-test`, `not-to-spec` | AD-3 |
| FR12f | `.dependency-cruiser.js` `not-to-dev-dep` | AD-3 |
| FR13, FR14, FR15, NFR8, NFR11, NFR12 | `Makefile` (`DEPCRUISE_BIN`, `lint-deps`, aggregate, DIND wrapper) | AD-6 |
| FR16, FR17, FR18, FR19, FR23, NFR3, NFR6 | `.github/workflows/dependency-cruiser.yml` | AD-7 |
| FR20, FR21, FR22 | `README.md` | AD-8 |

### Complete File Change Map

```text
website/
├── .dependency-cruiser.js                      [ADD]    CommonJS config: forbidden[16 rules] + options
├── package.json                                [MODIFY] devDependencies += dependency-cruiser ^17.x (NO scripts)
├── Makefile                                    [MODIFY] DEPCRUISE_BIN var; lint-deps target;
│                                                         lint: lint-next lint-tsc lint-md lint-deps;
│                                                         run-deps-lint-tests-dind wrapper
├── README.md                                   [MODIFY] "Dependency Cruiser / Architecture rules" section
├── .github/
│   └── workflows/
│       └── dependency-cruiser.yml              [ADD]    PR->main gate: checkout(SHA-pinned) + setup-node +
│                                                         pnpm@10.6.5 + cache + make install + make lint-deps CI=1
├── tsconfig.json                               (unchanged — referenced by options.tsConfig.fileName)
├── eslint.config.mjs                           (unchanged — no-restricted-imports stays; cruiser complements it)
└── src/                                         (UNCHANGED — no application code touched)
    ├── features/{landing,swagger,documentation,example,registration}/   (governed, not modified)
    ├── components/{UiButton,UiInput,AppTheme,Layout,...}/               (governed, not modified)
    ├── shared/ · config/                                                (governed)
    └── hooks/ utils/ lib/ providers/ types/ routes/ stores/            (reserved-empty; in shared-layer rule)
```

### Complete Drop-In `.dependency-cruiser.js`

> Ready to paste at the repository root during implementation. Adapted to the website FEATURE structure (NO `src/modules`), PascalCase-safe (NO global `no-uppercase-paths`), and includes the stakeholder-mandated `src-feature-name-kebab-case` rule.

```js
/**
 * dependency-cruiser configuration — VilnaCRM website
 *
 * Adapted from the CRM sister repo, rewritten for the website's FEATURE-BASED
 * structure (there is NO src/modules layer) and made PascalCase-safe:
 *   - Boundary rules target src/features/<feature>/, src/components/, and the
 *     foundational shared layers directly.
 *   - CRM's global `no-uppercase-paths` rule is DELIBERATELY OMITTED because the
 *     website's shared/feature COMPONENT directories are PascalCase by convention
 *     (UiButton, AboutUs, AppTheme). Lowercase enforcement is scoped to FEATURE
 *     directory NAMES only, via `src-feature-name-kebab-case` (rule 16).
 *
 * Run with: make lint-deps   (depcruise src tests --config .dependency-cruiser.js)
 */
module.exports = {
  forbidden: [
    // ── GENERIC HYGIENE (ported from CRM) ──────────────────────────────────

    // 1. Circular dependencies — closes the unconfigured ESLint import/no-cycle gap. (FR6)
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies are allowed.',
      from: {},
      to: { circular: true },
    },

    // 2. Orphan (unused) modules — entrypoints/configs/outputs are exempted. (FR12a)
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'Modules that are not imported by anything (orphans) are flagged.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$', // dot-files (.eslintrc.js, etc.)
          '[.]d[.]ts$', // type declarations
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:babel|webpack)[.]config[.][^/]+$',
          '(^|/)(?:commitlint|stryker)[.]config[.][^/]+$',
          '(^|/)__mocks__/',
          '(^|/)next[.]config[.]js$',
          '(^|/)jest[.]config[.]ts$',
          '(^|/)jest[.]mutation[.]config[.]ts$',
          '(^|/)babel-jest[.]config[.]js$',
          '(^|/)i18n[.]js$',
          '(^|/)mutation[.]js$',
          '(^|/)checkNodeVersion[.]js$',
          '(^|/)lighthouserc[.][^/]+[.]js$',
          '^pages/', // Next.js page entrypoints
          '^[.]storybook/',
          '^coverage/',
          '^test-results/',
          '^playwright-report/',
          '^storybook-static/',
        ],
      },
      to: {},
    },

    // 3. Deprecated core (Node built-in) modules. (FR12b)
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'Do not depend on deprecated Node core modules.',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^(v8/tools/codemap)$',
          '^(v8/tools/consarray)$',
          '^(v8/tools/csvparser)$',
          '^(v8/tools/logreader)$',
          '^(v8/tools/profile_view)$',
          '^(v8/tools/profile)$',
          '^(v8/tools/SourceMap)$',
          '^(v8/tools/splaytree)$',
          '^(v8/tools/tickprocessor-driver)$',
          '^(v8/tools/tickprocessor)$',
          '^(node-inspect/lib/_inspect)$',
          '^(node-inspect/lib/internal/inspect_client)$',
          '^(node-inspect/lib/internal/inspect_repl)$',
          '^(async_hooks)$',
          '^(punycode)$',
          '^(domain)$',
          '^(constants)$',
          '^(sys)$',
          '^(_linklist)$',
          '^(_stream_wrap)$',
        ],
      },
    },

    // 4. Deprecated npm packages. (FR12b)
    {
      name: 'not-to-deprecated',
      severity: 'warn',
      comment: 'Do not depend on npm packages flagged deprecated.',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },

    // 5. Imports not present in package.json. (FR12c)
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment: 'Do not depend on packages absent from package.json.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },

    // 6. Unresolvable modules (http(s) URLs excepted). (FR12c)
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Do not depend on modules that cannot be resolved.',
      from: {},
      to: { couldNotResolve: true, pathNot: ['^https?://'] },
    },

    // 7. A dependency declared under more than one type (type-only excepted). (FR12d)
    {
      name: 'no-duplicate-dep-types',
      severity: 'warn',
      comment: 'A dependency should be declared under exactly one dependency type.',
      from: {},
      to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] },
    },

    // 8. Non-test code must not import from test folders. (FR12e)
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'Production code must not import from test folders (src/test, tests).',
      from: { pathNot: '^(?:src/test|tests)' },
      to: { path: '^(?:src/test|tests)' },
    },

    // 9. Nothing may import *.spec / *.test files. (FR12e)
    {
      name: 'not-to-spec',
      severity: 'error',
      comment: 'Spec/test files must not be imported by anything.',
      from: {},
      to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
    },

    // 10. src runtime code must not import devDependencies. (FR12f)
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment: 'Runtime code under src must not depend on devDependencies.',
      from: {
        path: '^src',
        pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$',
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: ['node_modules/@types/'],
      },
    },

    // ── ARCHITECTURE BOUNDARY RULES (the feature-based adaptation) ──────────

    // 11. Outside code may import a feature ONLY through its index barrel. (FR7)
    //     Formalizes ESLint no-restricted-imports ['@/features/*/*'] at graph level.
    {
      name: 'features-import-via-public-api',
      severity: 'error',
      comment:
        'Import a feature only through its public index barrel; do not reach into its internals.',
      from: { path: '^src/', pathNot: '^src/features/[^/]+/' },
      to: {
        path: '^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+',
      },
    },

    // 12. A feature must not import a sibling feature at all. (FR8)
    {
      name: 'no-cross-feature-imports',
      severity: 'error',
      comment: 'A feature must not import another feature; use shared layers instead.',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/(?!$1/)' },
    },

    // 13. The shared UI library must stay feature-agnostic. (FR9)
    {
      name: 'no-shared-ui-to-features',
      severity: 'error',
      comment: 'src/components (shared UI) must not depend on any feature.',
      from: { path: '^src/components/' },
      to: { path: '^src/features/' },
    },

    // 14. Foundational shared layers must not depend on features. (FR10)
    {
      name: 'no-shared-layers-to-features',
      severity: 'error',
      comment: 'Foundational/shared layers must not depend on any feature.',
      from: {
        path: '^src/(?:shared|hooks|utils|lib|providers|types|config|routes|stores)/',
      },
      to: { path: '^src/features/' },
    },

    // 15. A feature root may only contain approved subfolders. (FR13a)
    {
      name: 'feature-allowed-folders',
      severity: 'error',
      comment:
        'A feature may only contain: api, assets, components, constants, helpers, hooks, i18n, routes, types, utils.',
      from: {
        path: '^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/',
      },
      to: {},
    },

    // 16. FEATURE DIRECTORY NAMES MUST BE LOWERCASE KEBAB-CASE. (FR11)
    //     *** STAKEHOLDER-MANDATED. Scoped to feature names ONLY — this is the
    //     deliberate replacement for CRM's omitted global no-uppercase-paths. ***
    {
      name: 'src-feature-name-kebab-case',
      severity: 'error',
      comment: 'Feature directory names must be lowercase kebab-case (e.g. user-onboarding).',
      from: { path: '^src/features/(?![a-z0-9-]+/)[^/]+/' },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: ['node_modules'] },
    detectProcessBuiltinModuleCalls: true,
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    // Resolve the @/* alias and TypeScript "bundler" moduleResolution.
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx'],
      mainFields: ['main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    // Website load tests import k6 (resolved by the k6 runtime, not Node).
    // NOTE: deliberately NO bun built-ins — the website is node/pnpm.
    builtInModules: { add: ['k6', 'k6/http'] },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
      archi: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
      text: { highlightFocused: true },
    },
  },
};
```

### Makefile `lint-deps` recipe (to be added)

```makefile
# --- variable, alongside the existing per-tool *_BIN vars ---
DEPCRUISE_BIN               = $(BIN_DIR)/depcruise

# --- target, alongside lint-next / lint-tsc / lint-md ---
lint-deps: ## Validate architecture/import boundaries with dependency-cruiser
	$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js

# --- aggregate (extend the existing line) ---
lint: lint-next lint-tsc lint-md lint-deps ## Runs all linters: ESLint, TypeScript, Markdown, and dependency-cruiser in sequence.

# --- DIND wrapper, mirroring run-eslint-tests-dind ---
run-deps-lint-tests-dind: ## Run dependency-cruiser tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running dependency-cruiser in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-deps CI=1)
```

### `.github/workflows/dependency-cruiser.yml` (to be added)

```yaml
name: dependency cruiser
on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  dependency-cruiser:
    runs-on: ubuntu-latest
    env:
      CI: 1
    steps:
      - name: Checkout code
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ vars.NODE_VERSION }}

      - name: Cache pnpm dependencies
        id: cache-pnpm-dependencies
        uses: actions/cache@v4.2.3
        with:
          path: node_modules
          key: ${{ runner.os }}-dependencies-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-dependencies-

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: make install
        if: steps.cache-pnpm-dependencies.outputs.cache-hit != 'true'

      - name: Validate architecture boundaries
        run: make lint-deps CI=1
```

### Architectural Boundaries

- **Inbound feature boundary:** only `<feature>/index.*` is importable from outside the feature (`features-import-via-public-api`).
- **Lateral feature boundary:** no feature → feature edges (`no-cross-feature-imports`).
- **Downward shared boundary:** `src/components` and shared layers may be imported BY features but must not import features (`no-shared-ui-to-features`, `no-shared-layers-to-features`).
- **Folder boundary:** feature roots restricted to the approved subfolder set (`feature-allowed-folders`).
- **Naming boundary:** feature slice names lowercase kebab-case; component dirs PascalCase-exempt (`src-feature-name-kebab-case`; `no-uppercase-paths` omitted).
- **Test boundary:** production code ↮ test code (`not-to-test`, `not-to-spec`); runtime code ↮ devDependencies (`not-to-dev-dep`).

### Integration Points

- **tsconfig.json** — read by `options.tsConfig.fileName` for `@/*` and `bundler` resolution.
- **Makefile `lint` aggregate** — `lint-deps` joins `lint-next`/`lint-tsc`/`lint-md`.
- **`make install` / pnpm** — installs the `dependency-cruiser` devDependency.
- **GitHub Actions required checks** — the dedicated workflow becomes a required PR check.
- **ESLint `no-restricted-imports`** — complementary; the cruiser reinforces the same barrier at graph level (no overlap conflict).

### Data Flow

```text
PR opened/updated -> main
        │
        ▼
dependency-cruiser.yml  (CI=1)
        │  checkout(SHA-pinned, no creds) → setup-node(${{vars.NODE_VERSION}})
        │  → cache → npm i -g pnpm → make install
        ▼
make lint-deps CI=1
        │  PNPM_EXEC=pnpm → depcruise src tests --config .dependency-cruiser.js
        ▼
resolver reads tsconfig.json → builds import graph (src + tests, no node_modules)
        ▼
forbidden[] evaluated  ──► error violation? ──► non-zero exit ──► FAILED check (FR17/NFR6)
                          │
                          └► only warn? ──► output, exit 0 ──► PASSED check
```

---

## Architecture Validation Results

### Coherence Validation

- The 16 forbidden rules map 1:1 to the PRD's enumerated rules; severities (`error`/`warn`) match the PRD exactly.
- The two deviations from CRM (omit `no-uppercase-paths`; add `src-feature-name-kebab-case`) are explicitly recorded (AD-4, FR11, FR12) and mutually consistent — together they deliver "lowercase feature names, PascalCase components".
- Makefile and workflow wiring follow observed conventions verbatim (`PNPM_EXEC`, `CI=1`, `BIN_DIR`, trailing `##`, SHA-pinned checkout, `vars.NODE_VERSION`, pnpm cache).
- No conflict with ESLint: the cruiser complements `no-restricted-imports`; neither disables the other.

### Requirements Coverage Validation

All 30 PRD requirements (FR1–FR23 incl. FR12a–f / FR13a, NFR1–NFR12) are mapped in the **Requirements to File Mapping** table and the **Decision Impact Analysis**. Spot checks:

- FR6 → `no-circular` (rule 1). FR7 → `features-import-via-public-api` (rule 11). FR8 → `no-cross-feature-imports` (rule 12). FR9/FR10 → rules 13/14. FR11 → `src-feature-name-kebab-case` (rule 16). FR12 → omission of `no-uppercase-paths` (documented AD-4). FR13a → `feature-allowed-folders` (rule 15).
- FR13/FR14/FR15 → Makefile recipe. FR16–FR19/FR23 → workflow + AD-7 alternative discussion. FR20/FR21/FR22 → README (AD-8).
- NFR1/NFR2/NFR5 → `skipAnalysisNotInRules`, `doNotFollow`, no build/no network. NFR9 → AD-4 + AD-5 (zero false positives on PascalCase + entrypoints). NFR10 → AD-2. NFR11/NFR12 → AD-6/AD-7 conventions.

### Gap Analysis Results

- **Closed gap:** `import/no-cycle` is unconfigured in ESLint today; `no-circular` (rule 1) closes it (FR6).
- **No residual functional gap:** every PRD FR has a concrete artifact.
- **Reserved-layer note (not a gap):** `src/hooks|utils|lib|providers|types|routes|stores` are empty today but already covered by `no-shared-layers-to-features` and the feature-allowed-folder list, so they are governed the moment they are populated.
- **Forward note:** if `tests/` content ever imports application internals deliberately, `not-to-test` already scopes correctly (`from` excludes test paths); no change needed.

### Architecture Completeness Checklist

- [x] All FR1–FR23 (incl. FR12a–f, FR13a) mapped to artifacts
- [x] All NFR1–NFR12 addressed by a decision
- [x] Complete drop-in `.dependency-cruiser.js` embedded (16 rules + options), feature-adapted, PascalCase-safe
- [x] `src-feature-name-kebab-case` (rule 16) INCLUDED
- [x] Global `no-uppercase-paths` EXCLUDED, with documented rationale (AD-4)
- [x] No `src/modules` references anywhere in the config
- [x] Makefile `lint-deps` recipe + aggregate + DIND wrapper embedded
- [x] Dedicated `dependency-cruiser.yml` embedded (SHA-pinned checkout, least-privilege permissions, `vars.NODE_VERSION`, pnpm cache)
- [x] FR23 alternative (ride `static-testing.yml`) documented and dedicated workflow recommended
- [x] Complete File Change Map ASCII tree provided (ADD/MODIFY)
- [x] Requirements-to-File mapping table provided
- [x] Resolver options pinned to `tsconfig.json` for `@/*` (FR3/NFR10)
- [x] `k6`/`k6/http` registered; bun built-ins deliberately omitted (FR5)
- [x] Planning-artifacts-only constraint honored (no real files created/edited)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High. The design is grounded in the observed Makefile, tsconfig, ESLint config, and `static-testing.yml`; the dependency graph is clean today, so the gate is expected green on introduction.

**Key Strengths:**

- Closes the real `import/no-cycle` gap and formalizes the feature-slice contract at graph level.
- Zero-false-positive by construction (PascalCase-safe; entrypoint allowlist; alias resolution pinned).
- Full CRM tooling parity (version, Makefile conventions, dedicated workflow) for cross-repo consistency.
- Self-contained, drop-in artifacts (config, Makefile recipe, workflow) ready to apply in one PR.

**Areas for Future Enhancement:**

- Emit/archive `dot`/`archi` graph artifacts for architecture review (PRD Phase 2).
- Pre-commit hook running `make lint-deps` for faster feedback (Phase 2).
- Codify allowed dependents for shared layers as they graduate from reserved-empty (Phase 3).
- Unify CRM + website generic-hygiene rules behind a shared preset (Phase 3).

### Implementation Handoff

A single self-validating PR against `main`: add the devDependency, drop in `.dependency-cruiser.js`, wire the Makefile (`DEPCRUISE_BIN`, `lint-deps`, aggregate, DIND wrapper), add `dependency-cruiser.yml`, add the README section. Validate locally with `make lint-deps CI=1` (expect zero violations) before push; the new workflow then proves itself green on the PR. No `src/` changes, so there is no behavioral risk. Downstream artifacts: `epics-dependency-cruiser-ci-2026-06-22.md` and the per-story implementation files reference the AD-numbers and FR/NFR ids established here.
