# Story 2.2: Add feature public-API barrel and no-cross-feature rules

Status: done

## Story

As a developer,
I want code outside a feature to import it only through its public `index` barrel and no feature to import a sibling feature at all,
so that the feature-slice contract is enforced at the dependency-graph level beyond what the per-file ESLint rule can catch.

## Acceptance Criteria

1. `features-import-via-public-api` has severity `error`, `from: { path: '^src/', pathNot: '^src/features/[^/]+/' }`, and `to: { path: '^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+' }`, formalizing ESLint `no-restricted-imports ['@/features/*/*']` at graph level (FR7).
2. Given an outside module imports `@/features/swagger/helpers/formatDate` (past the barrel), `make lint-deps` fires `features-import-via-public-api` and names the source and target modules (FR7, NFR7).
3. `no-cross-feature-imports` has severity `error`, `from: { path: '^src/features/([^/]+)/' }`, and `to: { path: '^src/features/(?!$1/)' }`, using the capture-group/negative-lookahead pattern so a feature importing a sibling fails (FR8).
4. Given a module in the `landing` feature imports from the `swagger` feature, `make lint-deps` fires `no-cross-feature-imports` (FR8).
5. Against current `main` (zero cross-feature imports), both rules produce zero violations (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add the `features-import-via-public-api` rule to the `forbidden[]` array (AC: 1, 2)
  - [x] 1.1 Insert the rule as boundary rule 11 in `.dependency-cruiser.js`, immediately after the generic hygiene rules (rules 1–10) and before `no-cross-feature-imports`, matching the PRD enumeration order.
  - [x] 1.2 Set `name: 'features-import-via-public-api'`, `severity: 'error'`, and a `comment` stating intent: "Import a feature only through its public index barrel; do not reach into its internals."
  - [x] 1.3 Set `from: { path: '^src/', pathNot: '^src/features/[^/]+/' }` so the rule applies to any source under `src/` that is NOT itself inside a feature (a feature importing its own internals is allowed).
  - [x] 1.4 Set `to: { path: '^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+' }` so only the `index` barrel (any supported extension) is an allowed import target; any deeper path is forbidden.
- [x] Task 2: Add the `no-cross-feature-imports` rule to the `forbidden[]` array (AC: 3, 4)
  - [x] 2.1 Insert the rule as boundary rule 12, immediately after `features-import-via-public-api`.
  - [x] 2.2 Set `name: 'no-cross-feature-imports'`, `severity: 'error'`, and a `comment`: "A feature must not import another feature; use shared layers instead."
  - [x] 2.3 Set `from: { path: '^src/features/([^/]+)/' }` with a capture group on the source feature name.
  - [x] 2.4 Set `to: { path: '^src/features/(?!$1/)' }` so the negative lookahead `(?!$1/)` back-references the captured source feature, forbidding any target feature that is NOT the same feature (sibling imports fail; intra-feature imports pass).
- [x] Task 3: Validate the barrel rule fires on a deep import (AC: 2)
  - [x] 3.1 Temporarily add an outside module that imports `@/features/swagger/helpers/formatDate` (past the barrel) and run `make lint-deps`.
  - [x] 3.2 Confirm `features-import-via-public-api` fires with a non-zero exit and the `text` reporter names the source and target modules (NFR7); remove the temporary import.
- [x] Task 4: Validate the cross-feature rule fires on a sibling import (AC: 4)
  - [x] 4.1 Temporarily add an import in the `landing` feature that pulls from the `swagger` feature and run `make lint-deps`.
  - [x] 4.2 Confirm `no-cross-feature-imports` fires; remove the temporary import.
- [x] Task 5: Confirm zero violations against current `main` (AC: 5)
  - [x] 5.1 Run `make lint-deps CI=1` on a clean checkout and confirm both new rules produce zero violations (the graph has zero cross-feature imports today).
  - [x] 5.2 Confirm the dedicated `dependency-cruiser.yml` workflow check passes green on the introducing PR.

## Dev Notes

### Architecture Decisions

These two rules are the core of decision **AD-3: Feature-based architecture boundary rules** (from architecture-dependency-cruiser-ci-2026-06-22.md). They are expressed directly against `src/features/<feature>/` — there is no `src/modules` layer on the website, so the sibling rule is one path segment shallower than the CRM analogue. Per **AR3** the exact regex shapes are mandatory: the barrel allowance `(?!index[.]...)` and the `no-cross-feature-imports` capture-group/negative-lookahead pattern (`from ^src/features/([^/]+)/`, `to ^src/features/(?!$1/)`).

Rule 11 — `features-import-via-public-api` (FR7), drop-in from the embedded config:

```js
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
```

Rule 12 — `no-cross-feature-imports` (FR8):

```js
{
  name: 'no-cross-feature-imports',
  severity: 'error',
  comment: 'A feature must not import another feature; use shared layers instead.',
  from: { path: '^src/features/([^/]+)/' },
  to: { path: '^src/features/(?!$1/)' },
},
```

Key points from the architecture:

- The barrel rule's `from.pathNot: '^src/features/[^/]+/'` is what makes it apply to *outside* code only — a feature reaching into its own internals is legitimate and must not be flagged. The `to` regex permits exactly the `index` barrel (any of `js|cjs|mjs|jsx|ts|cts|mts|tsx`) and forbids any deeper internal path (AD-3, **Inbound feature boundary**).
- `features-import-via-public-api` **formalizes the existing ESLint `no-restricted-imports ['@/features/*/*']` at the graph level** — the cruiser catches re-exported / dynamic deep imports the per-file ESLint rule misses (AD-3 rationale; the cruiser complements `no-restricted-imports`, neither disables the other — see Integration Points).
- `no-cross-feature-imports` is the precise feature-based analogue of CRM's module sibling rule, expressed one layer shallower because there is no module nesting (AD-3, **Lateral feature boundary**).
- `tsPreCompilationDeps: true` in `options` (from Story 1.2 / AD-2) means type-only edges (`import type`) are also captured, so a deep import or sibling import hidden behind `import type` is still caught.
- Both rules are `error` severity → any violation yields a non-zero exit and a failed required check (NFR6); the `text` reporter (`highlightFocused: true`) names rule/source/target (FR21, NFR7).

### Project Structure Notes

- **Modify (in-file):** `.dependency-cruiser.js` (repository root) — add rules 11 and 12 to the `forbidden[]` array, after the generic hygiene rules and before `no-shared-ui-to-features` (rule 13). No `options` changes are needed; the resolver/scope options from Story 1.2 already make `@/*` edges resolvable.
- **Depends on:** Story 1.2 (the `.dependency-cruiser.js` skeleton + `options` block) and Story 1.1 (the `dependency-cruiser` devDependency). Story 2.1 (`no-circular`, rule 1) may land before or after; ordering within `forbidden[]` follows the PRD enumeration regardless.
- **Not touched:** no file under `src/` is modified (NFR9); `package.json`, `Makefile`, the workflow, and `README.md` are out of scope for this story (covered by Stories 1.1, 4.x, 5.x, 6.x).
- Existing slices governed by these rules: `landing` (fully built), `swagger`, and the i18n-only stubs `documentation/`, `example/`, `registration/` — all import each other zero times today.

### Testing Approach

This is configuration / tooling, validated by running the tool, not by unit tests:

- Run `make lint-deps` (dev container) or `make lint-deps CI=1` (direct runner) and confirm **zero violations** against current `main` for both new rules (AC: 5).
- Positive-fire checks (AC: 2, 4) are performed by temporarily introducing a violating import (a deep `@/features/swagger/helpers/formatDate` import from outside; a `landing → swagger` import), confirming the expected rule fires with a non-zero exit and an actionable message naming source and target, then reverting the temporary edit. No violating import is committed.
- The dedicated `.github/workflows/dependency-cruiser.yml` workflow re-runs the same `make lint-deps CI=1` on the PR, proving the gate green on introduction (NFR3, NFR4, NFR9).

### References

- Architecture `## Core Architectural Decisions` → **AD-3: Feature-based architecture boundary rules** (FR7 / FR8 rule definitions and rationale) — architecture-dependency-cruiser-ci-2026-06-22.md.
- Architecture `### Complete Drop-In .dependency-cruiser.js` → rules 11 (`features-import-via-public-api`) and 12 (`no-cross-feature-imports`).
- Architecture `### Architectural Boundaries` → **Inbound feature boundary** and **Lateral feature boundary**; `### Integration Points` → ESLint `no-restricted-imports` complementarity.
- Architecture `### Implementation Patterns & Consistency Rules` → Naming/Format Patterns (kebab-case rule names; mandatory `^` anchors and `$1` back-reference).
- Epics `## Epic 2 Stories: Feature Architecture Boundary Rules` → **Story 2.2** (epics-dependency-cruiser-ci-2026-06-22.md); see also AR3.
- PRD Functional Requirements → **FR7** (`features-import-via-public-api`) and **FR8** (`no-cross-feature-imports`); NFR6, NFR7, NFR9.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added features-import-via-public-api and no-cross-feature-imports rules (tests exempt). Compliance refactor: relocated the SocialMedia component to src/components/SocialMedia and the social-media type to src/types/social-media, and repathed all importers.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `.dependency-cruiser.js`
- `src/components/SocialMedia/ (relocated from src/features/landing)`
- `src/types/social-media/index.ts (relocated)`
- `src/features/landing/components/Header/Drawer/Drawer.tsx`
- `src/components/UiFooter/*`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
