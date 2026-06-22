# Story 2.5: Add the feature-allowed-folders rule

Status: ready-for-dev

## Story

As a developer,
I want a feature root restricted to an approved set of subfolders,
so that feature slices keep a consistent internal structure and unexpected top-level folders are caught at PR time.

## Acceptance Criteria

1. `feature-allowed-folders` has severity `error`, `from: { path: '^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/' }`, and `to: {}` (FR13a).
2. Given a feature contains a top-level folder outside the approved set (`api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`), `make lint-deps` fires the rule and names the offending path (FR13a, NFR7).
3. The existing feature slices (`landing`, `swagger`, and the i18n-only stubs), whose subfolders are all within the approved set, produce zero violations on current `main` (NFR9).

## Tasks / Subtasks

- [ ] Task 1: Add the `feature-allowed-folders` rule to the `forbidden` array in `.dependency-cruiser.js` (AC: 1)
  - [ ] 1.1 Append the rule object as rule 15 in `forbidden[]`, after the boundary rules (`features-import-via-public-api`, `no-cross-feature-imports`, `no-shared-ui-to-features`, `no-shared-layers-to-features`) and before `src-feature-name-kebab-case` (rule 16), preserving the architecture's rule ordering.
  - [ ] 1.2 Set `name: 'feature-allowed-folders'` and `severity: 'error'`.
  - [ ] 1.3 Set `from.path` to the verbatim regex `^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/` — the `[^/]+/` after the feature segment plus the negative lookahead over the approved set matches any first-level subfolder NOT in the allowed alternation.
  - [ ] 1.4 Set `to: {}` so the rule matches purely on the source path (folder-structure check, not an edge target).
  - [ ] 1.5 Add a `comment` stating intent: `'A feature may only contain: api, assets, components, constants, helpers, hooks, i18n, routes, types, utils.'` (drives FR21 actionable output).
- [ ] Task 2: Validate the rule fires on a disallowed top-level feature folder and names the path (AC: 2)
  - [ ] 2.1 Temporarily introduce (or scaffold a fixture for) a feature subfolder outside the approved set, e.g. `src/features/landing/widgets/`, and confirm `make lint-deps` reports a `feature-allowed-folders` violation naming the offending path.
  - [ ] 2.2 Confirm the violation surfaces via the `text` reporter naming the rule and source path, and that the run exits non-zero (NFR6, NFR7).
  - [ ] 2.3 Remove the temporary fixture so the working tree returns to a clean state.
- [ ] Task 3: Verify zero false positives against current `main` (AC: 3)
  - [ ] 3.1 Run `make lint-deps CI=1` on a clean checkout of `main` with the rule in place.
  - [ ] 3.2 Confirm `landing`, `swagger`, and the i18n-only stubs (`documentation`, `example`, `registration`) produce zero `feature-allowed-folders` violations because every existing subfolder is within the approved set (`landing` uses `components`/`helpers`/etc.; the stubs are `i18n`-only).
  - [ ] 3.3 Confirm the addition of this single rule does not alter the result of the other already-authored rules (no new violations introduced).

## Dev Notes

### Architecture Decisions

This rule is part of **AD-3: Feature-based architecture boundary rules (the core contribution)** (from architecture-dependency-cruiser-ci-2026-06-22.md). FR13a `feature-allowed-folders` (error): a feature root may only contain approved subfolders (`api|assets|components|constants|helpers|hooks|i18n|routes|types|utils`); any other top-level folder is flagged.

The exact rule object to add to `forbidden[]` (from architecture-dependency-cruiser-ci-2026-06-22.md, "Complete Drop-In `.dependency-cruiser.js`", rule 15):

```js
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
```

Regex anatomy (from architecture-dependency-cruiser-ci-2026-06-22.md, AD-3 and "Format Patterns"):

- `^src/features/[^/]+/` anchors to a single feature slice directory immediately under `src/features/`.
- `(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)` is a negative lookahead that passes only when the next path segment is NOT one of the ten approved folder names.
- The trailing `[^/]+/` then consumes that disallowed first-level subfolder, so the rule matches files living under any unexpected top-level folder inside a feature.
- `to: {}` means the match is on the source module's path alone — this is a folder-structure invariant, not a cross-module edge, so no target predicate is needed.

Boundary classification (from architecture-dependency-cruiser-ci-2026-06-22.md, "Architectural Boundaries"): this is the **Folder boundary** — feature roots restricted to the approved subfolder set (`feature-allowed-folders`).

Severity rationale (from architecture-dependency-cruiser-ci-2026-06-22.md, "Format Patterns"): `error` for hard boundaries; an `error`-severity violation yields a non-zero exit and a failed CI check (NFR6).

Anti-pattern reminder (from architecture-dependency-cruiser-ci-2026-06-22.md, "Enforcement Guidelines"): resolve a real violation by moving the offending folder into an approved subfolder (or fixing the feature structure), not by widening the alternation. A legitimate new approved folder is a deliberate, reviewed change to this rule's lookahead, not an ad-hoc per-path exception.

### Project Structure Notes

Files to modify:

- `.dependency-cruiser.js` (repository root) — **MODIFY in-file**: add the `feature-allowed-folders` rule object to the `forbidden[]` array as rule 15, positioned after the four other boundary rules and immediately before `src-feature-name-kebab-case` (rule 16). No `options` changes are needed for this story; resolver/scope options (AD-2/AD-5) and the skeleton already exist from Epic 1 (Stories 1.1/1.2).

Files explicitly NOT touched:

- No file under `src/` is modified (NFR9). Existing slices `src/features/{landing,swagger,documentation,example,registration}/` are governed by this rule, not changed.
- No `package.json` `scripts` entry is added; the tool is invoked only through the Makefile via `$(PNPM_EXEC) $(DEPCRUISE_BIN)` (NFR12). The Makefile `lint-deps` target itself is delivered separately in Epic 4 (Story 4.1).

Existing structure this rule must stay green against (from architecture-dependency-cruiser-ci-2026-06-22.md, "Existing Conventions"):

- `landing` (fully built) uses approved subfolders only (e.g. `components`, `helpers`); PascalCase component dirs such as `src/features/landing/components/AboutUs/` are nested under the approved `components/` folder and are therefore not first-level feature subfolders, so they do not match this rule.
- `swagger` and the i18n-only stubs (`documentation`, `example`, `registration`) contain only approved subfolders (the stubs being `i18n`-only).

### Testing Approach

This is configuration / tooling, not application code — there are no unit tests for it. Validation is by running the tool and the CI workflow:

- Run `make lint-deps` (dev container) or `make lint-deps CI=1` (direct on runner) over `src tests` with `--config .dependency-cruiser.js`; against current `main` expect zero `feature-allowed-folders` violations (AC: 3, NFR9).
- Negative check: temporarily add a disallowed top-level feature folder (e.g. `src/features/landing/widgets/x.ts`) and confirm the rule fires, names the offending path via the `text` reporter, and produces a non-zero exit (AC: 2, NFR6, NFR7); remove the fixture afterward.
- The dedicated `.github/workflows/dependency-cruiser.yml` (Epic 5) re-runs `make lint-deps CI=1` on every PR to `main`, proving the rule green on the introducing PR and enforcing it thereafter.
- The analysis requires no app build, no service start, and no network at analysis time (NFR2, NFR5), and is deterministic across local and CI given identical source and config (NFR3, NFR4).

### References

- Architecture: AD-3 "Feature-based architecture boundary rules (the core contribution)", FR13a `feature-allowed-folders` bullet (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: "Complete Drop-In `.dependency-cruiser.js`" — rule 15 `feature-allowed-folders` (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: "Architectural Boundaries" — Folder boundary; "Format Patterns" — `error` severity and regex anchoring (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: "Requirements to File Mapping" — FR13a → `.dependency-cruiser.js` `feature-allowed-folders` → AD-3 (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics: Story 2.5 "Add the feature-allowed-folders rule" and its acceptance criteria; FR Coverage Map FR13a → Epic 2 → Story 2.5 (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD: FR13a (`feature-allowed-folders`, severity error); NFR7 (actionable violation output); NFR9 (zero false positives on `main`) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
