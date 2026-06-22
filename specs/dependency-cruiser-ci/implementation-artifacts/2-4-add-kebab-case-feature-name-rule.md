# Story 2.4: Add the stakeholder-mandated kebab-case feature-name rule and omit no-uppercase-paths

Status: ready-for-dev

## Story

As a developer,
I want feature directory names enforced as lowercase kebab-case while PascalCase component directories are left untouched,
so that the stakeholder-mandated naming convention holds without flooding the build with false positives on the codebase's PascalCase components.

## Acceptance Criteria

1. `src-feature-name-kebab-case` has severity `error`, `from: { path: '^src/features/(?![a-z0-9-]+/)[^/]+/' }`, `to: {}`, and a comment stating that feature directory names must be lowercase kebab-case (FR11).
2. CRM's global `no-uppercase-paths` rule is ABSENT from the forbidden array (FR12).
3. Given a feature directory `src/features/UserOnboarding/`, `make lint-deps` fires `src-feature-name-kebab-case` for that feature name (FR11).
4. PascalCase component directories such as `src/components/UiButton/` and `src/features/landing/components/AboutUs/` are NOT flagged by any rule (FR12, NFR9).
5. Against current `main` (kebab-case feature names only), the rule produces zero violations (NFR9).

## Tasks / Subtasks

- [ ] Task 1: Add the `src-feature-name-kebab-case` rule to `forbidden[]` (AC: 1)
  - [ ] 1.1 Append the rule object as rule 16 (last in the array, after `feature-allowed-folders`), matching the generic-hygiene-first / boundary-rules-last ordering from the architecture.
  - [ ] 1.2 Set `name: 'src-feature-name-kebab-case'` and `severity: 'error'`.
  - [ ] 1.3 Set `from: { path: '^src/features/(?![a-z0-9-]+/)[^/]+/' }` and `to: {}` — the negative lookahead `(?![a-z0-9-]+/)` matches any first path segment under `src/features/` that is NOT pure `[a-z0-9-]`.
  - [ ] 1.4 Add a `comment` stating that feature directory names must be lowercase kebab-case (e.g. `user-onboarding`), and call out prominently that this is the STAKEHOLDER-MANDATED replacement for the omitted CRM global `no-uppercase-paths`.
- [ ] Task 2: Confirm the deliberate omission of `no-uppercase-paths` (AC: 2)
  - [ ] 2.1 Verify NO rule named `no-uppercase-paths` exists anywhere in `forbidden[]`.
  - [ ] 2.2 Ensure the file-level header comment (or rule 16 comment) records the deviation so future maintainers do not "restore" the CRM rule and break the build (AR4).
- [ ] Task 3: Validate the rule fires on a non-kebab feature name (AC: 3)
  - [ ] 3.1 Temporarily create a fixture feature directory `src/features/UserOnboarding/` (with a module that is imported, so the graph reaches it) and run `make lint-deps`.
  - [ ] 3.2 Confirm `src-feature-name-kebab-case` fires for that feature name with a non-zero exit, then remove the fixture.
- [ ] Task 4: Validate PascalCase component dirs are NOT flagged (AC: 4)
  - [ ] 4.1 Run `make lint-deps` and confirm `src/components/UiButton/` and `src/features/landing/components/AboutUs/` produce zero `src-feature-name-kebab-case` violations (the lookahead only inspects the first segment under `src/features/`, so nested PascalCase component dirs pass untouched).
  - [ ] 4.2 Confirm no other rule flags these PascalCase paths.
- [ ] Task 5: Validate zero violations on current `main` (AC: 5)
  - [ ] 5.1 Run `make lint-deps CI=1` against current `main` (feature dirs: `documentation`, `example`, `landing`, `registration`, `swagger` — all kebab-case) and confirm the rule reports zero violations.

## Dev Notes

### Architecture Decisions

This story implements AD-4 — the headline trade-off of the website adaptation (from architecture-dependency-cruiser-ci-2026-06-22.md, "AD-4: Deliberate deviation from CRM — omit `no-uppercase-paths`, scope lowercase to feature names").

Add exactly this rule (rule 16 in the embedded drop-in config) to the `forbidden` array:

```js
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
```

Key correctness points (from architecture-dependency-cruiser-ci-2026-06-22.md):

- The negative lookahead `(?![a-z0-9-]+/)` anchors to the FIRST path segment under `src/features/`. `src/features/UserOnboarding/...` fails; `src/features/user-onboarding/...` passes; PascalCase component dirs nested inside a feature (`src/features/landing/components/AboutUs/...`) pass untouched because the lookahead only inspects the feature-name segment.
- `to: {}` means the rule fires on the `from` match alone (a from-only rule): the offending module's own path is the violation, independent of what it imports.
- CRM's global `no-uppercase-paths` is DELIBERATELY OMITTED (AD-4, FR12). The website's shared UI and feature *component* directories are PascalCase by established convention (`UiButton`, `UiInput`, `AppTheme`, `AboutUs`); porting the global rule verbatim would emit hundreds of false positives and violate NFR9. The only path-casing invariant the stakeholder requires is on feature *slice* names.
- Anti-pattern to avoid (from architecture, "Enforcement Guidelines / Anti-Patterns"): re-introducing CRM's global `no-uppercase-paths` (breaks PascalCase dirs — NFR9 violation). All AI agents MUST keep `src-feature-name-kebab-case` present (FR11) and keep `no-uppercase-paths` ABSENT (FR12).

The mandated rule ordering (from architecture, "Structure Patterns") is generic hygiene rules first (rules 1–10), then architecture boundary rules (rules 11–16); `src-feature-name-kebab-case` is rule 16 (last). Each rule must carry a `comment` (drives FR21 actionable output).

### Project Structure Notes

- **Modify:** `.dependency-cruiser.js` (repository root) — append the `src-feature-name-kebab-case` object to `forbidden[]` as rule 16; ensure `no-uppercase-paths` is absent. This is the only file this story changes.
- **Depends on:** Story 1.2 (the `.dependency-cruiser.js` skeleton and `options` block must already exist) and the preceding Epic 2 boundary-rule stories (2.1–2.3, 2.5) which populate the other `forbidden[]` rules.
- **No `src/` changes.** Current feature directories (`documentation`, `example`, `landing`, `registration`, `swagger`) are all kebab-case and stay untouched. The `src/features/UserOnboarding/` fixture in Task 3 is temporary validation scaffolding only and must be removed.
- **Not changed by this story:** Makefile, `package.json`, `.github/workflows/dependency-cruiser.yml`, README (covered by Epics 4, 5, 6 and Story 1.1).

### Testing Approach

This is configuration/tooling, not application code — there are no unit tests. Validation is by running the cruiser and the CI workflow:

- Run `make lint-deps` (dev container) and `make lint-deps CI=1` (direct runner) against current `main` and expect zero `src-feature-name-kebab-case` violations (AC 5) — feature names are all kebab-case today.
- Positive-fire check: create a temporary `src/features/UserOnboarding/` fixture (imported so the graph reaches it), confirm the rule fires with a non-zero exit naming the offending path, then remove the fixture (AC 3).
- Negative check: confirm `src/components/UiButton/` and `src/features/landing/components/AboutUs/` are NOT flagged by any rule (AC 4).
- The dedicated `dependency-cruiser.yml` workflow (Epic 5) re-validates the rule on every PR to `main`; the gate is expected green on introduction (NFR9).

### References

- Architecture: `architecture-dependency-cruiser-ci-2026-06-22.md` — AD-4 (omit `no-uppercase-paths`, scope lowercase to feature names); "Complete Drop-In `.dependency-cruiser.js`" (rule 16); "Implementation Patterns & Consistency Rules → Naming Patterns / Structure Patterns / Format Patterns / Enforcement Guidelines (Anti-Patterns)"; "Architectural Boundaries → Naming boundary"; Decision Impact Analysis (AD-4 → FR11/FR12, NFR9).
- Epics: `epics-dependency-cruiser-ci-2026-06-22.md` — Epic 2 → Story 2.4; AR4 (Additional Requirements); FR Coverage Map (FR11/FR12 → Epic 2 / Story 2.4).
- PRD: `prd-dependency-cruiser-ci-2026-06-22.md` — FR11 (`src-feature-name-kebab-case`, stakeholder-mandated), FR12 (omit `no-uppercase-paths`; scope to feature names, documented deviation), NFR9 (zero false positives on `main`; PascalCase component dirs not flagged).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
