# Story 2.1: Add the no-circular rule to close the import/no-cycle gap

Status: done

## Story

As a developer,
I want any circular dependency to fail the build,
so that the gap left by ESLint's unconfigured `import/no-cycle` rule is permanently closed for everyone.

## Acceptance Criteria

1. The rule is named `no-circular` with severity `error`, `from: {}` and `to: { circular: true }`, carrying a `comment` stating intent (FR6).
2. Given a module graph that contains a cycle, `make lint-deps` fires the rule, prints the full cycle path, and produces a non-zero exit (FR6, NFR6, NFR7).
3. Against current `main` (which has no cycles), the rule produces zero violations (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add the `no-circular` rule to the `forbidden` array in `.dependency-cruiser.js` (AC: 1)
  - [x] 1.1 Append the rule object as the FIRST entry in `forbidden[]` (rule 1, the head of the generic-hygiene block), before any boundary rule, matching the PRD/architecture enumeration order.
  - [x] 1.2 Set the exact shape: `name: 'no-circular'`, `severity: 'error'`, `from: {}`, `to: { circular: true }`.
  - [x] 1.3 Carry a `comment` that states intent and the gap it closes, e.g. `'No circular dependencies are allowed.'` (drives the FR21 actionable output).
  - [x] 1.4 Confirm the rule depends on the already-authored `options` block from Story 1.2 (resolver pinned to `tsconfig.json`, `tsPreCompilationDeps: true`) so cycles hidden behind `@/*` aliases and `import type` edges are still detected.
- [x] Task 2: Validate that the rule fires on a cycle and produces a non-zero exit (AC: 2)
  - [x] 2.1 In a scratch/throwaway state (NOT committed), introduce a deliberate two-module cycle under `src/` to prove the rule fires.
  - [x] 2.2 Run `make lint-deps CI=1` and confirm the `text` reporter names `no-circular`, prints the full cycle path (source → … → source), and the command exits non-zero (NFR6, NFR7).
  - [x] 2.3 Revert the scratch cycle so no `src/` file is changed by this story.
- [x] Task 3: Validate zero violations against current `main` (AC: 3)
  - [x] 3.1 Run `make lint-deps CI=1` on the clean tree and confirm `no-circular` reports zero violations and the command exits zero.
  - [x] 3.2 Confirm the dedicated `dependency-cruiser.yml` CI check passes green on the introducing PR (the graph is clean today).

## Dev Notes

### Architecture Decisions

This rule is the first entry of the `forbidden[]` array authored under **AD-3: Feature-based architecture boundary rules** (from `architecture-dependency-cruiser-ci-2026-06-22.md`). It is the precise mechanism that closes the gap called out in the architecture's **Gap Analysis Results**: ESLint's `import/no-cycle` is **NOT** configured in the website's `eslint.config.mjs` today, so circular dependencies are currently unguarded. `no-circular` makes any cycle a hard CI failure.

The exact rule object to add to `.dependency-cruiser.js` (verbatim from the Complete Drop-In config in AD-3, rule 1):

```js
// 1. Circular dependencies — closes the unconfigured ESLint import/no-cycle gap. (FR6)
{
  name: 'no-circular',
  severity: 'error',
  comment: 'No circular dependencies are allowed.',
  from: {},
  to: { circular: true },
},
```

Key decisions this rule relies on (from `architecture-dependency-cruiser-ci-2026-06-22.md`):

- **AD-2 resolver options** — `tsConfig.fileName: 'tsconfig.json'` plus `enhancedResolveOptions` let the resolver follow `@/*` edges; without it the graph would be unresolvable and cycles invisible. `tsPreCompilationDeps: true` captures type-only (`import type`) edges so cycles hidden behind type imports are still seen.
- **Severity `error`** maps to non-zero exit and a failed required check (NFR6); `from: {}` / `to: { circular: true }` is the dependency-cruiser idiom for "any module that participates in a cycle".
- **Ordering** — generic hygiene rules come first (rules 1–10), then architecture boundary rules (rules 11–16). `no-circular` is rule 1. (Format/Structure Patterns.)
- **Zero false positives on `main`** — the architecture records the graph is clean today (no cycles), so this rule is expected green on introduction (NFR9; Architecture Readiness Assessment).

### Project Structure Notes

- **Modify:** `.dependency-cruiser.js` (repository root) — add the `no-circular` object as the first element of the `forbidden` array. This is the only file this story changes.
- **Depends on:** Story 1.1 (the `dependency-cruiser ^17.x` devDependency) and Story 1.2 (the `.dependency-cruiser.js` skeleton + `options` block). Those must be in place for this rule to run.
- **Depends on (for validation):** Story 4.1 (`make lint-deps` target). If validating before Epic 4 lands, invoke the binary directly: `$(PNPM_EXEC) ./node_modules/.bin/depcruise src tests --config .dependency-cruiser.js`.
- **Do NOT touch:** any file under `src/`, `pages/`, the `Makefile`, the workflow, or the README — those belong to other stories. No application behavior changes (NFR2).

### Testing Approach

This is configuration / tooling, not application code; it is validated by running the tool and the CI workflow, not by unit tests.

- **Dry-run / local cruise:** run `make lint-deps CI=1` (or the direct `depcruise src tests --config .dependency-cruiser.js`) against the clean tree and confirm zero `no-circular` violations (AC 3).
- **Negative check:** temporarily introduce a deliberate cycle under `src/` (uncommitted), re-run, and confirm the `text` reporter names the rule, prints the full cycle path, and the command exits non-zero (AC 2); then revert.
- **CI validation:** the dedicated `.github/workflows/dependency-cruiser.yml` runs `make lint-deps CI=1` on every PR to `main`; the introducing PR proves the rule green (NFR1, NFR9).
- Determinism: the same commit yields the same pass/fail every run, with no network at analysis time (NFR3, NFR5).

### References

- Architecture: `architecture-dependency-cruiser-ci-2026-06-22.md` — **AD-3: Feature-based architecture boundary rules** (rule 1 `no-circular`); **AD-2: Resolver options** (`tsConfig` / `tsPreCompilationDeps`); **Complete Drop-In `.dependency-cruiser.js`** (rule 1 code block); **Gap Analysis Results** (unconfigured `import/no-cycle`); **Format / Structure Patterns** (rule object shape and ordering); **Data Flow** (error → non-zero exit → failed check).
- Epics: `epics-dependency-cruiser-ci-2026-06-22.md` — **Story 2.1** (Epic 2: Feature Architecture Boundary Rules); **FR Coverage Map** (FR6 → Epic 2 / Story 2.1).
- PRD: `prd-dependency-cruiser-ci-2026-06-22.md` — **FR6** (`no-circular`, severity error). Supporting NFRs: **NFR6** (error → non-zero exit / failed check), **NFR7** (actionable output naming rule/source/target), **NFR9** (zero false positives on `main`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added the no-circular rule (error). Closes the unconfigured ESLint import/no-cycle gap. Verified 0 cycles on main.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `.dependency-cruiser.js`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
