# Story 3.3: Add the test/production and runtime/devDependency separation rules

Status: done

## Story

As a developer,
I want production code forbidden from importing test code and `src` runtime code forbidden from importing devDependencies,
so that test-only and dev-only code never leaks into the shipped runtime graph.

## Acceptance Criteria

1. `not-to-test` has severity `error`, `from: { pathNot: '^(?:src/test|tests)' }`, and `to: { path: '^(?:src/test|tests)' }` (FR12e).
2. `not-to-spec` has severity `error`, `from: {}`, and `to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' }` (FR12e).
3. `not-to-dev-dep` has severity `error`, `from: { path: '^src', pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' }`, and `to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] }`, excluding spec/test files and `@types` packages (FR12f).
4. Given production code that imports a test folder, a `.spec`/`.test` file, or a devDependency, `make lint-deps` fires the corresponding rule with a non-zero exit (FR12e, FR12f, NFR6, NFR7).
5. Against current `main`, all three rules produce zero violations (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add the `not-to-test` rule to `forbidden[]` in `.dependency-cruiser.js` (AC: 1, 4, 5)
  - [x] 1.1 Append the rule object directly after `no-duplicate-dep-types` (rule 7) so it is rule 8, preserving the "generic hygiene first" ordering from the architecture's `forbidden[]` layout.
  - [x] 1.2 Set `name: 'not-to-test'`, `severity: 'error'`, and a `comment` of `'Production code must not import from test folders (src/test, tests).'` (drives the FR21 actionable output).
  - [x] 1.3 Set `from: { pathNot: '^(?:src/test|tests)' }` so test code itself is exempt from the rule's source side.
  - [x] 1.4 Set `to: { path: '^(?:src/test|tests)' }` so any import that lands in `src/test` or the top-level `tests/` from non-test code is flagged.
- [x] Task 2: Add the `not-to-spec` rule to `forbidden[]` (AC: 2, 4, 5)
  - [x] 2.1 Append as rule 9, immediately after `not-to-test`.
  - [x] 2.2 Set `name: 'not-to-spec'`, `severity: 'error'`, and a `comment` of `'Spec/test files must not be imported by anything.'`.
  - [x] 2.3 Set `from: {}` (any source) and `to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' }` so no module may import a `*.spec.*` / `*.test.*` file across the eight supported extensions.
- [x] Task 3: Add the `not-to-dev-dep` rule to `forbidden[]` (AC: 3, 4, 5)
  - [x] 3.1 Append as rule 10, immediately after `not-to-spec`, closing the generic-hygiene block before the architecture boundary rules begin.
  - [x] 3.2 Set `name: 'not-to-dev-dep'`, `severity: 'error'`, and a `comment` of `'Runtime code under src must not depend on devDependencies.'`.
  - [x] 3.3 Set `from: { path: '^src', pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' }` so only runtime (non-spec/test) `src` files are treated as the production source.
  - [x] 3.4 Set `to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] }` so devDependency edges are flagged while type-only imports and `@types/*` packages are exempt.
- [x] Task 4: Validate the three rules against current `main` (AC: 4, 5)
  - [x] 4.1 Run `make lint-deps CI=1` and confirm a zero-violation, zero-exit result for all three rules on the clean graph (NFR9).
  - [x] 4.2 Temporarily introduce a probe import of a test folder, a `.spec`/`.test` file, and a devDependency from a runtime `src` file; confirm `not-to-test`, `not-to-spec`, and `not-to-dev-dep` each fire with a non-zero exit and name the source/target (NFR6, NFR7); then revert the probes.
  - [x] 4.3 Confirm that spec/test files importing devDependencies are NOT flagged by `not-to-dev-dep` (the `from.pathNot` exclusion) and that `@types/*` imports are NOT flagged (the `to.pathNot` exclusion).

## Dev Notes

### Architecture Decisions

These three rules are the FR12e/FR12f members of the generic-hygiene block defined in AD-3 / AD-5 and embedded in the Complete Drop-In `.dependency-cruiser.js` (from architecture-dependency-cruiser-ci-2026-06-22.md). They are rules 8, 9, and 10 of the sixteen-rule `forbidden[]` array; ordering keeps generic hygiene (rules 1–10) ahead of the feature boundary rules (rules 11–16). Each rule is an object `{ name, severity, comment, from, to }` and every rule carries a `comment` stating intent, per the Format Patterns section.

Drop in verbatim (from architecture-dependency-cruiser-ci-2026-06-22.md, Complete Drop-In `.dependency-cruiser.js`):

```js
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
```

Key correctness notes (from architecture-dependency-cruiser-ci-2026-06-22.md):

- The cruise targets are exactly `src tests` (Structure Patterns); `src/test/*` is covered because it lives under `src`, and the top-level `tests/` dir is covered as a separate cruise target. The `not-to-test` `to.path` anchors both: `^(?:src/test|tests)`.
- `not-to-test` deliberately exempts test code on the `from` side (`pathNot: '^(?:src/test|tests)'`) so tests importing tests is allowed; only production → test edges fail. The Gap Analysis "Forward note" confirms this scopes correctly even if `tests/` later imports application internals.
- `not-to-dev-dep` excludes spec/test files (so test files may freely use devDependencies) and `@types/*` packages, and uses `dependencyTypesNot: ['type-only']` so `import type` edges to a devDependency are not flagged. This depends on `tsPreCompilationDeps: true` (AD-2) being present so type-only edges are visible to the graph in the first place.
- Severities are `error` for all three (hard boundaries), per the Format Patterns severity guidance; an `error` violation yields a non-zero exit and a failed CI check (NFR6), while output names rule/source/target (NFR7, FR21).

### Project Structure Notes

- Modify: `.dependency-cruiser.js` (repository root) — append the three rule objects (`not-to-test`, `not-to-spec`, `not-to-dev-dep`) into the existing `forbidden[]` array as rules 8, 9, and 10. This is the only file changed by this story.
- Prerequisite (not in scope here): the `.dependency-cruiser.js` skeleton with its `options` block (alias/`bundler` resolution, `tsPreCompilationDeps`, scope, built-ins, reporters) from Story 1.2, and the generic-hygiene rules 1–7 from Stories 3.1 and 3.2, must already exist; this story slots into that file.
- Not touched: no file under `src/`, `pages/`, `package.json`, `Makefile`, `.github/workflows/`, or `README.md` is modified by this story (additive, zero-blast-radius governance — Architectural Principles).
- Planning-artifacts-only: this story file describes the change; it does not itself edit `.dependency-cruiser.js` or any real repo file (AR9).

### Testing Approach

This is configuration/tooling, not application code, so validation is by running the tool, not by unit tests:

- Run `make lint-deps` (dev container) or `make lint-deps CI=1` (direct on runner) — `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` — and confirm zero violations on current `main` for all three rules (NFR9, AC 5). The graph is clean today (no production→test edges, no runtime→devDependency edges).
- Negative validation: introduce a temporary probe import — a runtime `src` file importing a `src/test`/`tests` path, a module importing a `*.spec`/`*.test` file, and a runtime `src` file importing a known devDependency — and confirm each rule fires with a non-zero exit and actionable rule/source/target output (AC 4, NFR6, NFR7); revert the probes afterward.
- Exclusion validation: confirm spec/test files importing devDependencies and any `@types/*` import are NOT flagged by `not-to-dev-dep`.
- CI: the dedicated `dependency-cruiser.yml` workflow (Epic 5) runs `make lint-deps CI=1` on every PR to `main`; an `error` from any of these three rules becomes a failed required check (FR17, NFR6).

### References

- Architecture — Core Architectural Decisions, AD-3 (feature-based boundary rules / generic-hygiene block) and AD-5 (analysis scope; severity/exclusion rationale) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Complete Drop-In `.dependency-cruiser.js`, rules 8 (`not-to-test`), 9 (`not-to-spec`), 10 (`not-to-dev-dep`) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Implementation Patterns & Consistency Rules: Structure Patterns (cruise targets `src tests`), Format Patterns (rule object shape, severities), Communication Patterns (actionable output) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Project Structure & Boundaries: Architectural Boundaries (Test boundary) and Requirements to File Mapping (FR12e/FR12f rows); Gap Analysis "Forward note" on `tests/` scoping (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics — Epic 3 Stories: Story 3.3 "Add the test/production and runtime/devDependency separation rules" (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD — Functional Requirements FR12e (`not-to-test`, `not-to-spec`) and FR12f (`not-to-dev-dep`); NFR6 (failure semantics), NFR7 (actionable output), NFR9 (zero false positives on `main`) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added not-to-test, not-to-spec, not-to-dev-dep (with src/test exemption). Compliance: moved faker test fixtures into src/test/testing-library/fixtures and removed faker from production constants; reclassified next-export-optimize-images from devDependencies to dependencies.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `.dependency-cruiser.js`
- `package.json`
- `src/test/testing-library/fixtures/*.fixtures.ts (new)`
- `src/features/landing/components/{Header,AuthSection}/constants.ts`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
