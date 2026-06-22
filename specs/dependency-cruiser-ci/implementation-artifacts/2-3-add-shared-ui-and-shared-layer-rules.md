# Story 2.3: Add shared-UI and shared-layer feature-agnostic rules

Status: ready-for-dev

## Story

As a developer,
I want the shared UI library and the foundational shared layers to be forbidden from depending on any feature,
so that shared code stays reusable and feature-agnostic and the dependency direction stays one-way.

## Acceptance Criteria

1. `no-shared-ui-to-features` has severity `error`, `from: { path: '^src/components/' }`, and `to: { path: '^src/features/' }` (FR9).
2. `no-shared-layers-to-features` has severity `error`, `from: { path: '^src/(?:shared|hooks|utils|lib|providers|types|config|routes|stores)/' }`, and `to: { path: '^src/features/' }`, covering both populated (`shared`, `config`) and reserved-empty layers (`hooks`, `utils`, `lib`, `providers`, `types`, `routes`, `stores`) (FR10).
3. Given a shared component or shared layer imports from `src/features/`, `make lint-deps` fires the corresponding rule and names the source and target (FR9, FR10, NFR7).
4. Against current `main`, both rules produce zero violations (NFR9).

## Tasks / Subtasks

- [ ] Task 1: Add the `no-shared-ui-to-features` rule to the `forbidden` array (AC: 1)
  - [ ] 1.1 Insert the rule into `.dependency-cruiser.js` `forbidden[]` as rule 13, immediately after `no-cross-feature-imports` (rule 12) and before `no-shared-layers-to-features` (rule 14), preserving the architecture-boundary ordering.
  - [ ] 1.2 Set `name: 'no-shared-ui-to-features'`, `severity: 'error'`, `from: { path: '^src/components/' }`, `to: { path: '^src/features/' }`.
  - [ ] 1.3 Add a `comment` stating intent: `'src/components (shared UI) must not depend on any feature.'` (drives the FR21 actionable output).
- [ ] Task 2: Add the `no-shared-layers-to-features` rule to the `forbidden` array (AC: 2)
  - [ ] 2.1 Insert the rule as rule 14, immediately after `no-shared-ui-to-features` (rule 13) and before `feature-allowed-folders` (rule 15).
  - [ ] 2.2 Set `name: 'no-shared-layers-to-features'`, `severity: 'error'`, `from: { path: '^src/(?:shared|hooks|utils|lib|providers|types|config|routes|stores)/' }`, `to: { path: '^src/features/' }`.
  - [ ] 2.3 Verify the source alternation enumerates all nine foundational layers — both populated (`shared`, `config`) and the seven reserved-empty layers (`hooks`, `utils`, `lib`, `providers`, `types`, `routes`, `stores`).
  - [ ] 2.4 Add a `comment` stating intent: `'Foundational/shared layers must not depend on any feature.'`.
- [ ] Task 3: Validate both rules locally (AC: 3, 4)
  - [ ] 3.1 Run `make lint-deps CI=1` against current `main` and confirm zero violations from both new rules (NFR9).
  - [ ] 3.2 Temporarily introduce a probe edge — a `src/components/` module (or a `src/shared/` module) importing from `src/features/` — run `make lint-deps`, confirm the matching rule fires and the `text` reporter names source and target, then revert the probe (do NOT commit it).
  - [ ] 3.3 Confirm a firing `error`-severity violation yields a non-zero exit (NFR6).
- [ ] Task 4: Confirm scope and ordering invariants (AC: 1, 2)
  - [ ] 4.1 Confirm the two rules are `error` severity (hard boundaries) and sit within the architecture-boundary block (rules 11-16), not the generic-hygiene block (rules 1-10).
  - [ ] 4.2 Confirm the inverse direction (a feature importing `src/components/` or a shared layer) is NOT flagged — these rules are one-way only; features may consume shared code.

## Dev Notes

### Architecture Decisions

Both rules belong to **AD-3: Feature-based architecture boundary rules (the core contribution)** (from architecture-dependency-cruiser-ci-2026-06-22.md). They encode the **downward shared boundary**: `src/components` and the foundational shared layers may be imported BY features but must never import features, keeping the dependency direction one-way.

Rule 13 — `no-shared-ui-to-features` (FR9), exactly as embedded in the Complete Drop-In `.dependency-cruiser.js`:

```js
// 13. The shared UI library must stay feature-agnostic. (FR9)
{
  name: 'no-shared-ui-to-features',
  severity: 'error',
  comment: 'src/components (shared UI) must not depend on any feature.',
  from: { path: '^src/components/' },
  to: { path: '^src/features/' },
},
```

Rule 14 — `no-shared-layers-to-features` (FR10), exactly as embedded in the Complete Drop-In `.dependency-cruiser.js`:

```js
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
```

Reserved-layer note (from architecture **Gap Analysis Results**): `src/hooks|utils|lib|providers|types|routes|stores` are empty today (each holds only a `.gitignore` placeholder) but are already enumerated in the `from` alternation, so they are governed the moment they are populated — no future rule edit needed when a reserved layer graduates. The Enforcement Guidelines note that any *new* shared layer added later must be appended to this alternation.

This story depends on Epic 1 (Stories 1.1 and 1.2): the `dependency-cruiser` devDependency and the `.dependency-cruiser.js` skeleton with the resolver/scope `options` block must already exist so `@/*` edges resolve and these rules evaluate without `not-to-unresolvable` flooding (AD-1, AD-2).

### Project Structure Notes

Files to modify:

- `.dependency-cruiser.js` (repository root) — ADD rules 13 (`no-shared-ui-to-features`) and 14 (`no-shared-layers-to-features`) inside the `forbidden[]` array, in the architecture-boundary block (after rule 12 `no-cross-feature-imports`, before rule 15 `feature-allowed-folders`). No `options` change is required by this story.

Files NOT touched:

- No file under `src/` is modified (NFR9). Governed surfaces — `src/components/{UiButton,UiInput,AppTheme,Layout,...}` and `src/shared/` · `src/config/` plus the reserved-empty layers — are observed, not changed.
- `Makefile`, `package.json`, `.github/workflows/dependency-cruiser.yml`, and `README.md` are out of scope for this story (Epics 4-6).

### Testing Approach

This is configuration / tooling, not application code; it is validated by running the cruiser, not by a unit-test suite.

- Run `make lint-deps` (dev container) or `make lint-deps CI=1` (direct on runner) over `src tests`.
- Expect **zero violations** from both rules against current `main` (NFR9) — there are no shared-UI-to-feature or shared-layer-to-feature edges today.
- Positive-firing check: temporarily add a probe import from `src/components/` (or `src/shared/`) into `src/features/`, confirm the rule fires with an actionable `text` report naming rule/source/target (NFR7) and a non-zero exit (NFR6), then revert the probe before committing.
- Final validation occurs in CI once Epic 5 lands: the dedicated `dependency-cruiser.yml` workflow runs `make lint-deps CI=1` on every PR to `main`.

### References

- Architecture — **AD-3: Feature-based architecture boundary rules (the core contribution)** (from architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — **Complete Drop-In `.dependency-cruiser.js`**, rules 13 and 14 (from architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — **Architectural Boundaries** ("Downward shared boundary") and **Gap Analysis Results** (reserved-layer note).
- Architecture — **Requirements to File Mapping** (FR9 -> `no-shared-ui-to-features`; FR10 -> `no-shared-layers-to-features`).
- Epics — **Story 2.3: Add shared-UI and shared-layer feature-agnostic rules** (Epic 2: Feature Architecture Boundary Rules).
- PRD — Functional Requirements **FR9** (`no-shared-ui-to-features`) and **FR10** (`no-shared-layers-to-features`); NFR6, NFR7, NFR9.

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
