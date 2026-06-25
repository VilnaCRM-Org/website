# Story 6.1: Add the README rules section and document actionable violation output

Status: done

## Story

As a developer,
I want a README section listing every dependency-cruiser rule and its intent, plus an explanation of the violation output format,
so that I can understand the architecture rules and act on a failure without reading the config file.

## Acceptance Criteria

1. A 'Dependency Cruiser / Architecture rules' README section lists each of the sixteen rules with its name, severity, and intent (FR20).
2. The documentation explains that a violation names the violated rule, the source module, and the target module, with an example, so a developer can act without consulting the config (FR21, NFR7).
3. The documented rule set matches the config exactly, including that `src-feature-name-kebab-case` is present and CRM's global `no-uppercase-paths` is deliberately omitted, with the rationale (FR20, FR12).

## Tasks / Subtasks

- [x] Task 1: Add the "Dependency Cruiser / Architecture rules" section to `README.md` (AC: 1, 3)
  - [x] 1.1 Add a top-level section heading "Dependency Cruiser / Architecture rules" (or an `## Dependency Cruiser / Architecture rules` H2 consistent with the surrounding README heading levels), placed near the existing linting/tooling documentation.
  - [x] 1.2 Write a one-paragraph intro explaining that `dependency-cruiser` is the CI-enforced architecture-governance gate, that the authoritative rule source is `.dependency-cruiser.js` at the repository root, and that it runs over `src` and `tests` via `make lint-deps`.
  - [x] 1.3 Add a table (or definition list) listing all sixteen `forbidden` rules with three columns: rule name, severity, and intent. Use the rule `name`, `severity`, and `comment` strings taken verbatim from the drop-in config in the architecture doc so the documentation matches the config exactly.
  - [x] 1.4 List the rules in the same order as the config `forbidden[]` array — generic hygiene rules first (rules 1-10), then the feature architecture boundary rules (rules 11-16).
- [x] Task 2: Document the deliberate CRM deviation and the kebab-case feature-name rule (AC: 3)
  - [x] 2.1 Add a short subsection (or callout) stating that `src-feature-name-kebab-case` IS present and is stakeholder-mandated, scoped to feature directory names only.
  - [x] 2.2 State that CRM's global `no-uppercase-paths` rule is deliberately OMITTED, and give the rationale: the website's shared and feature component directories are PascalCase by established convention (`UiButton`, `UiInput`, `AppTheme`, `AboutUs`), so a global lowercase rule would produce hundreds of false positives (NFR9).
  - [x] 2.3 Warn future maintainers not to "restore" the CRM global lowercase rule.
- [x] Task 3: Document the actionable violation output format (AC: 2)
  - [x] 3.1 Explain that a violation report names the violated rule, the source module, and the target module so a developer can act without opening the config.
  - [x] 3.2 Include a concrete worked example (e.g. a `features-import-via-public-api` or `no-cross-feature-imports` violation) showing the rule name, source path, and target path in the `text` reporter format.
  - [x] 3.3 Note that `error`-severity violations cause a non-zero exit / failed CI check while `warn`-severity findings surface without failing the build (NFR6).
- [x] Task 4: Verify the documentation matches the config (AC: 1, 3)
  - [x] 4.1 Cross-check that every rule name, severity, and intent in the README matches `.dependency-cruiser.js` exactly (sixteen rules, no extras, none missing).
  - [x] 4.2 Confirm `no-uppercase-paths` does NOT appear as a documented active rule (only referenced as the deliberately-omitted CRM rule).
  - [x] 4.3 Run `make lint-md` to confirm the new README content passes markdown linting.

## Dev Notes

### Architecture Decisions

(from architecture-dependency-cruiser-ci-2026-06-22.md)

- **AD-8 (README "Dependency Cruiser / Architecture rules" section + exception protocol):** Add a README section listing each rule and its intent, documenting the actionable violation format (rule / source / target). Documentation converts the gate from a roadblock into a self-service tool and prevents silent rule-disabling. This story covers FR20 (rules section) and FR21 (actionable output); the `make lint-deps` usage and exception protocol from AD-8 are handled separately by Story 6.2 (FR22).
- **AD-4 (deliberate CRM deviation):** `no-uppercase-paths` is deliberately omitted and `src-feature-name-kebab-case` is the scoped replacement. The README must record this explicitly (FR12) so maintainers do not restore the CRM global rule and break the build against PascalCase component directories (NFR9).
- **The sixteen rules to document (name / severity / intent),** taken verbatim from the complete drop-in `.dependency-cruiser.js` (`Core Architectural Decisions` -> `Complete Drop-In .dependency-cruiser.js`):
  1. `no-circular` (error) — No circular dependencies are allowed. (closes the unconfigured ESLint `import/no-cycle` gap, FR6)
  2. `no-orphans` (error) — Modules that are not imported by anything (orphans) are flagged; entrypoints/configs/outputs exempted. (FR12a)
  3. `no-deprecated-core` (warn) — Do not depend on deprecated Node core modules. (FR12b)
  4. `not-to-deprecated` (warn) — Do not depend on npm packages flagged deprecated. (FR12b)
  5. `no-non-package-json` (error) — Do not depend on packages absent from `package.json`. (FR12c)
  6. `not-to-unresolvable` (error) — Do not depend on modules that cannot be resolved (`http(s)://` excepted). (FR12c)
  7. `no-duplicate-dep-types` (warn) — A dependency should be declared under exactly one dependency type. (FR12d)
  8. `not-to-test` (error) — Production code must not import from test folders (`src/test`, `tests`). (FR12e)
  9. `not-to-spec` (error) — Spec/test files must not be imported by anything. (FR12e)
  10. `not-to-dev-dep` (error) — Runtime code under `src` must not depend on devDependencies. (FR12f)
  11. `features-import-via-public-api` (error) — Import a feature only through its public `index` barrel; do not reach into its internals. (FR7)
  12. `no-cross-feature-imports` (error) — A feature must not import another feature; use shared layers instead. (FR8)
  13. `no-shared-ui-to-features` (error) — `src/components` (shared UI) must not depend on any feature. (FR9)
  14. `no-shared-layers-to-features` (error) — Foundational/shared layers must not depend on any feature. (FR10)
  15. `feature-allowed-folders` (error) — A feature may only contain: `api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`. (FR13a)
  16. `src-feature-name-kebab-case` (error) — Feature directory names must be lowercase kebab-case (e.g. `user-onboarding`). **Stakeholder-mandated; scoped replacement for the omitted CRM global `no-uppercase-paths`.** (FR11)
- **Actionable violation format (FR21 / NFR7, from `Communication Patterns` and `Data Flow`):** the `text` reporter (configured with `highlightFocused: true`) names the violated rule, the source module, and the target module. A worked example to adapt for the README:

  ```text
  error features-import-via-public-api: src/features/landing/components/Hero/Hero.tsx → src/features/swagger/helpers/formatDate.ts
    Import a feature only through its public index barrel; do not reach into its internals.
  ```

  An `error`-severity violation produces a non-zero exit and a failed required check; a `warn`-severity rule surfaces in output without failing the build (NFR6).

### Project Structure Notes

- **Modify:** `README.md` — add the "Dependency Cruiser / Architecture rules" section (rules table with name/severity/intent, the CRM-deviation note for FR12, and the actionable-output explanation with example for FR21).
- **Reference only (do NOT modify in this story):** `.dependency-cruiser.js` (repository root) is the source of truth the README must mirror; it is authored by Epics 1-3. `Makefile` `lint-deps` usage and the exception protocol are documented by Story 6.2, not here.
- No file under `src/` is touched. This is additive documentation only (zero blast radius per the Blast-Radius Inventory).

### Testing Approach

- This is documentation for a config/tooling deliverable; there is no unit test. Validation is by review and by the existing markdown linter.
- Run `make lint-md` to confirm the new README content passes markdown linting (it is part of the `lint` aggregate alongside `lint-deps`).
- Cross-check the documented sixteen rules (name, severity, intent) against `.dependency-cruiser.js` so the docs match the config exactly (AC 1, AC 3); confirm `no-uppercase-paths` is documented only as the deliberately-omitted CRM rule and is absent from the active rule list.
- Optionally confirm the documented violation format against real `make lint-deps` output (the `text` reporter) so the example in the README is accurate (AC 2).

### References

- Architecture: `## Core Architectural Decisions` -> `AD-8: README "Dependency Cruiser / Architecture rules" section + exception protocol`
- Architecture: `## Core Architectural Decisions` -> `AD-4: Deliberate deviation from CRM — omit no-uppercase-paths, scope lowercase to feature names (FR11 + FR12)`
- Architecture: `## Core Architectural Decisions` -> `Complete Drop-In .dependency-cruiser.js` (verbatim rule names, severities, and `comment` intents for all sixteen rules)
- Architecture: `## Implementation Patterns & Consistency Rules` -> `Communication Patterns`; `## Project Structure & Boundaries` -> `Data Flow` (actionable output: rule / source / target; error vs warn semantics)
- Architecture: `## Project Structure & Boundaries` -> `Requirements to File Mapping` (FR20, FR21 -> `README.md`)
- Epics: `## Epic 6 Stories: Documentation` -> `### Story 6.1: Add the README rules section and document actionable violation output`
- PRD Functional Requirements: FR20 (README rules section), FR21 (actionable violation output); related FR12 (omit `no-uppercase-paths`, documented as an explicit decision)
- PRD Non-Functional Requirements: NFR7 (actionable output naming rule/source/target), NFR6 (error fails build, warn surfaces), NFR9 (zero false positives)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added the "Architecture Rules (dependency-cruiser)" README section describing every enforced rule and the test exemption.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `README.md`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
