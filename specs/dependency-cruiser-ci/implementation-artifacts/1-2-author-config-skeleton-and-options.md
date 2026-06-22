# Story 1.2: Author the .dependency-cruiser.js skeleton and resolver/scope options

Status: done

## Story

As a CI maintainer,
I want a root-level CommonJS `.dependency-cruiser.js` with the complete `options` block (alias resolution, analysis scope, performance, built-ins, reporters),
so that the import graph for `src` and `tests` is correctly resolvable and the rule arrays added later run with zero false positives.

## Acceptance Criteria

1. The config is a root-level CommonJS file exporting `module.exports = { forbidden: [], options: {...} }`, ready to receive the sixteen rules (FR2).
2. `options` sets `tsConfig.fileName: 'tsconfig.json'` and an `enhancedResolveOptions` block with `exportsFields ['exports']`, `conditionNames ['import','require','node','default','types']`, TS-first extensions `['.ts','.tsx','.d.ts','.js','.jsx']`, and `mainFields ['main','types','typings']` so `@/*` and `bundler` moduleResolution resolve correctly (FR3, NFR10).
3. `options` sets `tsPreCompilationDeps: true`, `combinedDependencies: true`, and `detectProcessBuiltinModuleCalls: true` so type-only (`import type`) edges and process built-in calls are captured.
4. `options` sets `doNotFollow.path: ['node_modules']` and `skipAnalysisNotInRules: true` (FR4, NFR1, NFR2, NFR5).
5. `options.builtInModules` adds exactly `['k6','k6/http']` and deliberately does NOT add any bun built-ins (FR5).
6. `options.reporterOptions` configures the `dot`, `archi`, and `text` reporters, with `dot`/`archi` using the `node_modules/(?:@[^/]+/[^/]+|[^/]+)` collapse pattern and `text` using `highlightFocused: true`.
7. Running `depcruise` against current `main` with this skeleton resolves all internal `@/*` edges without `not-to-unresolvable`-style flooding (NFR9, NFR10).

## Tasks / Subtasks

- [x] Task 1: Create the root-level CommonJS config skeleton (AC: 1)
  - [x] 1.1 Add `.dependency-cruiser.js` at the repository root (NOT `.mjs`/`.ts`/ESM) so the `depcruise` binary consumes it with zero transpile step.
  - [x] 1.2 Export `module.exports = { forbidden: [], options: {...} }`; leave `forbidden` as an empty array placeholder so Stories 2.1–3.3 can append the sixteen rules into it.
  - [x] 1.3 Add the top-of-file doc comment recording the website FEATURE-BASED adaptation (no `src/modules`) and the PascalCase-safe deviation, matching the architecture drop-in header.
- [x] Task 2: Author the resolver options that close the `@/*` / `bundler` gap (AC: 2)
  - [x] 2.1 Set `options.tsConfig = { fileName: 'tsconfig.json' }` so the resolver reads the `@/*` -> `./src/*` alias.
  - [x] 2.2 Add `options.enhancedResolveOptions` with `exportsFields: ['exports']`, `conditionNames: ['import','require','node','default','types']`, TS-first `extensions: ['.ts','.tsx','.d.ts','.js','.jsx']`, and `mainFields: ['main','types','typings']`.
- [x] Task 3: Author the graph-capture options (AC: 3)
  - [x] 3.1 Set `options.tsPreCompilationDeps: true` so `import type` edges are captured.
  - [x] 3.2 Set `options.combinedDependencies: true`.
  - [x] 3.3 Set `options.detectProcessBuiltinModuleCalls: true`.
- [x] Task 4: Author the analysis-scope / performance options (AC: 4)
  - [x] 4.1 Set `options.doNotFollow = { path: ['node_modules'] }`.
  - [x] 4.2 Set `options.skipAnalysisNotInRules: true`.
- [x] Task 5: Register k6 built-in modules, omit bun (AC: 5)
  - [x] 5.1 Set `options.builtInModules = { add: ['k6', 'k6/http'] }`.
  - [x] 5.2 Do NOT add any bun built-ins; add an inline comment recording that the website is node/pnpm.
- [x] Task 6: Author reporter options (AC: 6)
  - [x] 6.1 Configure `reporterOptions.dot.collapsePattern` and `reporterOptions.archi.collapsePattern` to `node_modules/(?:@[^/]+/[^/]+|[^/]+)`.
  - [x] 6.2 Configure `reporterOptions.text.highlightFocused: true`.
- [x] Task 7: Validate resolution against current `main` (AC: 7)
  - [x] 7.1 With Story 1.1's devDependency installed (`make install`), run `depcruise src tests --config .dependency-cruiser.js` (or via the Story 4.1 `make lint-deps` target once available).
  - [x] 7.2 Confirm internal `@/*` edges resolve and there is no `not-to-unresolvable`-style flooding; an empty `forbidden` array means no violations should be reported.

## Dev Notes

### Architecture Decisions (from architecture-dependency-cruiser-ci-2026-06-22.md)

- **AD-1 — Single CommonJS config.** The deliverable is one root-level `.dependency-cruiser.js` shaped as `module.exports = { forbidden: [...16 rules...], options: {...} }`. CommonJS (not ESM/`.mjs`/`.ts`) for direct, zero-config consumption by the `depcruise` binary and CRM parity. This story authors the file and the complete `options` block; the `forbidden` array starts empty and is populated by Epics 2 and 3. (FR2)
- **AD-2 — Resolver options pinned to `tsconfig.json` + `enhancedResolveOptions`.** Every internal import is `@/...`; without reading `tsconfig.json` the resolver cannot follow these edges and `not-to-unresolvable` would fire on nearly every file. TS-first extensions and exports/condition names make `bundler` moduleResolution and modern packages (MUI v7, Emotion, Apollo) resolve correctly. `tsPreCompilationDeps` captures type-only edges so cycles/boundaries hidden behind `import type` are still seen. (FR3, NFR10)
- **AD-5 — Analysis scope, built-ins, reporters.** `doNotFollow.path: ['node_modules']` and `skipAnalysisNotInRules: true` keep the cruise under the ~30 s budget with no app build and no network. `k6`/`k6/http` are registered as built-in modules so load-test imports are not unresolvable; bun built-ins are deliberately NOT added (website is node/pnpm). (FR4, FR5, NFR1, NFR2, NFR5)
- The exact `options` block to author (verbatim from the architecture drop-in):

```js
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
```

- The `module.exports` wrapper this story creates (with the empty `forbidden` placeholder Epics 2–3 fill):

```js
module.exports = {
  forbidden: [
    // Rules 1–16 added by Epic 2 (boundary) and Epic 3 (hygiene) stories.
  ],
  options: {
    /* the options block above */
  },
};
```

- **Anti-patterns to avoid (Enforcement Guidelines):** never author this config as ESM/`.mjs`/`.ts`; never point the cruise at `node_modules` or omit `doNotFollow`; never add bun built-ins; never omit `tsConfig.fileName` (every `@/*` edge would become unresolvable).
- **Observed constraint (Technical Constraints & Dependencies):** `tsconfig.json` declares exactly two `paths` aliases — `@/*` -> `./src/*` and `@swagger/global` -> a single SCSS file — and uses `moduleResolution: 'bundler'`; pointing `tsConfig.fileName` at `tsconfig.json` is what makes `@/*` resolvable (FR3, NFR10).

### Project Structure Notes

- **ADD:** `.dependency-cruiser.js` at the repository root — new CommonJS config with an empty `forbidden: []` and the complete `options` block. Inert until `make lint-deps` runs (added in Story 4.1).
- **No MODIFY in this story:** `package.json`, `Makefile`, the workflow, and `README.md` are out of scope here (the devDependency is Story 1.1; Makefile wiring is Epic 4; workflow is Epic 5; README is Epic 6).
- **UNCHANGED / referenced only:** `tsconfig.json` is read at analysis time via `options.tsConfig.fileName` but is not edited. No file under `src/` is touched (NFR9, zero blast radius).
- **Cruise targets** are exactly `src tests` (the `tests/` directory exists at the repository root; `src/test/*` is also covered because it lives under `src`).

### Testing Approach

- This is configuration/tooling, not application code; there are no unit tests to author. It is validated by **dry-run** and via CI.
- After Story 1.1 installs the devDependency, run `depcruise src tests --config .dependency-cruiser.js` (or `make lint-deps` / `make lint-deps CI=1` once Story 4.1 lands). With an empty `forbidden` array the expected result is a clean run: no violations and, critically, no `not-to-unresolvable`-style flooding of internal `@/*` edges (AC 7, NFR9, NFR10).
- The full gate is exercised once Epics 2–3 add the sixteen rules and Epic 5 runs the dedicated `dependency-cruiser.yml` workflow on PRs to `main`; the expected outcome on the clean graph of current `main` is zero violations within the ~30 s budget (NFR1, NFR9).

### References

- Architecture `architecture-dependency-cruiser-ci-2026-06-22.md`: `## Core Architectural Decisions` — AD-1 (Single CommonJS config), AD-2 (Resolver options), AD-5 (Analysis scope / built-ins / reporters); `### Complete Drop-In .dependency-cruiser.js` (the `options` block authored verbatim here); `## Implementation Patterns & Consistency Rules` — Structure/Format Patterns and Enforcement Guidelines/Anti-Patterns; `## Project Context Analysis` — Technical Constraints & Dependencies (tsconfig observed) and Cross-Cutting Concerns (alias resolution, k6 imports).
- Epics `epics-dependency-cruiser-ci-2026-06-22.md`: Epic 1 (Tooling Foundation), Story 1.2; Additional Requirements AR1, AR2, AR5.
- PRD `prd-dependency-cruiser-ci-2026-06-22.md`: FR2, FR3, FR4, FR5; NFR1, NFR2, NFR5, NFR9, NFR10.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Authored .dependency-cruiser.js (module.exports with forbidden[] + options): tsConfig=tsconfig.json, enhancedResolveOptions for the @/* alias, k6 built-ins, skipAnalysisNotInRules, tsPreCompilationDeps, reporterOptions.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `.dependency-cruiser.js`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
