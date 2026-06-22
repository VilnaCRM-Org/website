# Story 3.2: Add deprecation, resolvability, and duplicate-dep-type advisories

Status: ready-for-dev

## Story

As a developer,
I want warnings on deprecated/duplicate dependencies and errors on unresolvable or non-package.json imports,
so that dependency hygiene issues surface (as warnings) and unresolvable or undeclared dependencies fail the build.

## Acceptance Criteria

1. `no-deprecated-core` (severity warn, `to.dependencyTypes ['core']` with the deprecated core-module path list) and `not-to-deprecated` (severity warn, `to.dependencyTypes ['deprecated']`) are present (FR12b).
2. `not-to-unresolvable` (severity error, `to: { couldNotResolve: true, pathNot: ['^https?://'] }`) and the not-present-in-package.json rule (severity error, `to.dependencyTypes ['npm-no-pkg','npm-unknown']`) are present, excluding `http(s)://` URLs (FR12c).
3. `no-duplicate-dep-types` has severity warn, `to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] }` (FR12d).
4. A warn-severity violation surfaces in `make lint-deps` output but does NOT cause a non-zero exit; an error-severity violation DOES cause a non-zero exit (NFR6).
5. Against current `main`, the error-severity rules in this story produce zero violations (NFR9).

## Tasks / Subtasks

- [ ] Task 1: Add the deprecation advisory rules to `forbidden[]` (AC: 1)
  - [ ] 1.1 Add `no-deprecated-core` as rule 3 in `forbidden[]`: `severity: 'warn'`, `from: {}`, `to: { dependencyTypes: ['core'], path: [...deprecated core-module list] }`, with a `comment` stating intent.
  - [ ] 1.2 Populate the `to.path` deprecated core-module list verbatim from the architecture config (the `v8/tools/*`, `node-inspect/lib/*`, `async_hooks`, `punycode`, `domain`, `constants`, `sys`, `_linklist`, `_stream_wrap` anchored entries).
  - [ ] 1.3 Add `not-to-deprecated` as rule 4 in `forbidden[]`: `severity: 'warn'`, `from: {}`, `to: { dependencyTypes: ['deprecated'] }`, with a `comment` stating intent.
- [ ] Task 2: Add the resolvability / package.json-presence rules to `forbidden[]` (AC: 2)
  - [ ] 2.1 Add the not-present-in-package.json rule `no-non-package-json` as rule 5 in `forbidden[]`: `severity: 'error'`, `from: {}`, `to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] }`, with a `comment` stating intent.
  - [ ] 2.2 Add `not-to-unresolvable` as rule 6 in `forbidden[]`: `severity: 'error'`, `from: {}`, `to: { couldNotResolve: true, pathNot: ['^https?://'] }`, so `http(s)://` URLs are excluded.
- [ ] Task 3: Add the duplicate-dependency-type rule to `forbidden[]` (AC: 3)
  - [ ] 3.1 Add `no-duplicate-dep-types` as rule 7 in `forbidden[]`: `severity: 'warn'`, `from: {}`, `to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] }`, with a `comment` stating intent.
- [ ] Task 4: Verify warn-vs-error severity semantics (AC: 4)
  - [ ] 4.1 Confirm the two warn rules surface in `make lint-deps` output without changing the exit code (NFR6).
  - [ ] 4.2 Confirm the two error rules cause a non-zero exit / failed check when they fire (NFR6).
- [ ] Task 5: Validate zero false positives on current `main` (AC: 5)
  - [ ] 5.1 Run `make lint-deps CI=1` against `main` and confirm `not-to-unresolvable` and `no-non-package-json` report zero violations (relies on the AD-2 resolver options being present).

## Dev Notes

### Architecture Decisions

These rules are rules 3-7 of the sixteen-rule `forbidden[]` array, in the GENERIC HYGIENE block, and are taken verbatim from the **Complete Drop-In `.dependency-cruiser.js`** in the architecture doc (from architecture-dependency-cruiser-ci-2026-06-22.md). They are categorized under AD-3 / AD-5 (Requirements to File Mapping: FR12b → `no-deprecated-core`, `not-to-deprecated`; FR12c → `not-to-unresolvable`, `no-non-package-json`; FR12d → `no-duplicate-dep-types`).

Naming note: the epics AC refers to "the not-present-in-package.json rule"; the architecture config names this rule `no-non-package-json`. Use the config name `no-non-package-json` to stay faithful to the drop-in config.

Add these objects to `forbidden[]` exactly as authored:

```js
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
```

Severity semantics (NFR6): `warn`-severity rules (`no-deprecated-core`, `not-to-deprecated`, `no-duplicate-dep-types`) surface in output without affecting the exit code; `error`-severity rules (`no-non-package-json`, `not-to-unresolvable`) cause a non-zero exit and a failed CI check. This is dependency-cruiser's built-in behavior — no special handling is needed beyond setting `severity` correctly.

Resolver dependency (AD-2): `not-to-unresolvable` and `no-non-package-json` reporting zero violations on `main` (AC 5) depends on the `options` block from Story 1.2 already being present — specifically `tsConfig.fileName: 'tsconfig.json'`, `enhancedResolveOptions`, and `builtInModules.add: ['k6', 'k6/http']`. Without those, every `@/*` and `k6` edge would flood `not-to-unresolvable`. This story does not author `options`; it only adds the five rules.

### Project Structure Notes

Files modified by this story:

- `.dependency-cruiser.js` (repository root) — MODIFY in-file only: append rules 3-7 to the `forbidden[]` array (the GENERIC HYGIENE block). No change to `options`, no change to any other rule.

Files NOT touched: `package.json`, `Makefile`, `.github/workflows/dependency-cruiser.yml`, `README.md`, `tsconfig.json`, and everything under `src/`. This story is purely additive to the `forbidden[]` array.

Sequencing: depends on Story 1.2 (the `.dependency-cruiser.js` skeleton + `options` block). Sibling Story 3.1 (`no-orphans`) and Story 3.3 (`not-to-test` / `not-to-spec` / `not-to-dev-dep`) add the remaining Epic 3 hygiene rules to the same `forbidden[]` block.

### Testing Approach

This is configuration/tooling, validated by running dependency-cruiser and the CI workflow — there is no unit-test suite for the config itself:

- Run `make lint-deps CI=1` (or `make lint-deps` inside the dev container) against current `main` and confirm a clean exit with zero `error`-severity violations from `not-to-unresolvable` and `no-non-package-json` (AC 5, NFR9).
- Confirm the `text` reporter output names the violated rule, source, and target for any finding (NFR7).
- Verify severity behavior (AC 4): a temporary throwaway probe (e.g. an import of a deprecated module, then reverted) should show the `warn` rule surfacing in output with exit code 0, while an unresolvable / undeclared import causes a non-zero exit. Do not commit any probe.
- The dedicated `dependency-cruiser.yml` workflow (Epic 5) exercises the same `make lint-deps CI=1` path on every PR to `main`.

### References

- Architecture sections: `## Core Architectural Decisions` → AD-3 (boundary/hygiene rule design), AD-5 (analysis scope, severity semantics, k6 built-ins); `### Complete Drop-In .dependency-cruiser.js` (rules 3-7 verbatim); `## Project Structure & Boundaries` → `### Requirements to File Mapping` (FR12b/FR12c/FR12d rows); `## Architecture Validation Results` → `### Coherence Validation` (severities match the PRD) — all in architecture-dependency-cruiser-ci-2026-06-22.md.
- Epics: `## Epic 3 Stories: Generic Hygiene Rules` → `### Story 3.2: Add deprecation, resolvability, and duplicate-dep-type advisories` in epics-dependency-cruiser-ci-2026-06-22.md.
- PRD functional requirements: FR12b (deprecated core + npm advisories), FR12c (unresolvable + not-present-in-package.json errors), FR12d (duplicate dependency-type advisory); NFR6 (error → non-zero exit; warn → surface only), NFR7 (actionable output), NFR9 (zero false positives on `main`).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
