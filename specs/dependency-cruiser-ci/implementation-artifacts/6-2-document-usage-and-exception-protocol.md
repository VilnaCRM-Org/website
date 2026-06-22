# Story 6.2: Document make lint-deps usage and the exception protocol

Status: ready-for-dev

## Story

As a developer,
I want documented usage for `make lint-deps` (local and CI) and a clear protocol for adding a justified exception,
so that I can run the gate correctly and request a scoped exception in PR instead of silently disabling a rule.

## Acceptance Criteria

1. The README shows `make lint-deps` for local/container runs and `make lint-deps CI=1` for direct-runner runs, and notes it is part of `make lint` (FR22).
2. The exception protocol instructs maintainers to add a narrow, justified `pathNot`/`comment` scoped to the specific rule, reviewed in PR, and explicitly warns against disabling a whole rule to silence a single violation (FR22).
3. The documentation states that the preferred resolution is to fix the offending dependency, with an exception used only when the dependency is legitimate (FR22).

## Tasks / Subtasks

- [ ] Task 1: Add the "Running the gate" usage subsection to the README "Dependency Cruiser / Architecture rules" section (AC: 1)
  - [ ] 1.1 Document `make lint-deps` as the local/container run: with no flags `PNPM_EXEC` resolves to `$(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`), so the cruise runs inside the dev Docker container.
  - [ ] 1.2 Document `make lint-deps CI=1` as the direct-runner run: with `CI=1` (or `1/true/TRUE`) `PNPM_EXEC` resolves to `pnpm`, so `depcruise` runs directly on the runner — the exact invocation the dedicated workflow uses.
  - [ ] 1.3 State that `lint-deps` is part of the `lint` aggregate (`lint: lint-next lint-tsc lint-md lint-deps`), so `make lint` runs the architecture gate alongside ESLint, TypeScript, and Markdown linting; mention it is discoverable via `make help` (FR14).
  - [ ] 1.4 Show the underlying command the target runs for transparency: `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` cruising `src` and `tests`.
- [ ] Task 2: Add the "Exception protocol" subsection to the README (AC: 2, 3)
  - [ ] 2.1 State that the preferred resolution to any violation is to fix the offending dependency (e.g. route the import through the feature `index` barrel, move shared code into a shared layer, break the cycle); an exception is used ONLY when the dependency is legitimate (AC: 3).
  - [ ] 2.2 Document that a justified exception is a narrow `pathNot` (and a `comment` explaining the why) added to the specific rule it relaxes — never a global allowlist and never a whole-rule disable (AC: 2).
  - [ ] 2.3 Explicitly warn against disabling an entire rule (removing it from `forbidden[]` or flipping its severity off) to silence a single violation; the scope of any exception must be the minimum path that clears the legitimate case (AC: 2).
  - [ ] 2.4 State that every exception is reviewed in the PR that introduces it, so the scope and justification are visible to reviewers rather than landing silently (AC: 2).
- [ ] Task 3: Validate the documentation against the implemented gate (AC: 1, 2, 3)
  - [ ] 3.1 Confirm the documented commands match the Makefile target verbatim (`make lint-deps`, `make lint-deps CI=1`, aggregate membership) and that `make help` lists `lint-deps`.
  - [ ] 3.2 Run `make lint-deps CI=1` to confirm the documented direct-runner invocation succeeds on current `main`.
  - [ ] 3.3 Confirm an exception example uses a scoped `pathNot`/`comment` on a single rule and does not introduce any application-code change (no `src/` edit).

## Dev Notes

### Architecture Decisions

This story implements the usage and exception-protocol half of AD-8 (the README "Dependency Cruiser / Architecture rules" section), the companion to Story 6.1 which documents the rule list and the violation-output format (from architecture-dependency-cruiser-ci-2026-06-22.md, AD-8).

- AD-8 — README usage + exception protocol (from architecture-dependency-cruiser-ci-2026-06-22.md): "Add a README section ... documenting `make lint-deps` usage (local + `CI=1`) ... and explaining how to add a **justified, scoped exception** (a narrow `pathNot`/`comment` addition to the specific rule, reviewed in PR) rather than disabling enforcement wholesale." Rationale: "Documentation converts the gate from a roadblock into a self-service tool and prevents silent rule-disabling, preserving long-term integrity."
- Process Patterns (from architecture-dependency-cruiser-ci-2026-06-22.md): "Local: `make lint-deps` (container) or `make lint-deps CI=1` (host) before pushing. Aggregate: `make lint` runs all four linters in sequence including `lint-deps`." This is the exact local/CI usage AC 1 documents.
- Communication Patterns (from architecture-dependency-cruiser-ci-2026-06-22.md): "Maintainer → maintainer: exceptions are added as a scoped `pathNot`/`comment` on the specific rule, reviewed in PR." This is the precise wording AC 2 codifies.
- Enforcement Guidelines — All AI Agents MUST (from architecture-dependency-cruiser-ci-2026-06-22.md): "Resolve a violation by fixing the dependency, not by widening a rule; an exception requires a justified, scoped `pathNot` reviewed in PR." This grounds AC 3 (fix first, except only legitimate dependencies).
- Anti-Patterns (from architecture-dependency-cruiser-ci-2026-06-22.md): "Disabling a whole rule to silence one violation instead of a scoped exception." The README warning in AC 2 must call this out by name.
- Makefile dual-mode behavior (from architecture-dependency-cruiser-ci-2026-06-22.md, AD-6 / Technical Constraints): `CI ?= 0` with `1/true/TRUE` normalized to `1`; when `CI=1`, `PNPM_EXEC = pnpm` (runs directly on the runner) else `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`). The `lint-deps` recipe runs `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js`; the aggregate is `lint: lint-next lint-tsc lint-md lint-deps`. These exact strings are what the usage docs reference.

### Project Structure Notes

Files to add/modify (planning describes the change; this story does not edit real repo files beyond this markdown):

- `README.md` [MODIFY] — extend the "Dependency Cruiser / Architecture rules" section (introduced in Story 6.1) with two subsections: (a) "Running the gate" covering `make lint-deps`, `make lint-deps CI=1`, and `make lint` aggregate membership; (b) "Exception protocol" covering fix-first guidance, the scoped `pathNot`/`comment` mechanism, the whole-rule-disable warning, and PR review.
- No other files change. This is documentation only — no `.dependency-cruiser.js`, `Makefile`, workflow, `package.json`, or `src/` edits in this story.
- Depends on the artifacts described by prior stories being in place so the docs describe real behavior: the `make lint-deps` target and aggregate (Story 4.1, AD-6), the dedicated `dependency-cruiser.yml` workflow's `make lint-deps CI=1` invocation (Story 5.1, AD-7), and the rule list / config that exceptions are scoped against (Epics 1–3). Coordinates with Story 6.1 (same README section); avoid duplicating the rule list — this story adds usage + exception content only.

### Testing Approach

This is documentation/tooling, not application code; it is validated by inspection and by running the real gate it describes rather than by unit tests:

- Verify the documented commands match the Makefile verbatim: `make lint-deps` (container default), `make lint-deps CI=1` (direct runner), and the `lint: lint-next lint-tsc lint-md lint-deps` aggregate; confirm `make help` lists `lint-deps`.
- Run `make lint-deps CI=1` on current `main` to confirm the documented direct-runner invocation succeeds (expect zero violations — clean graph today, NFR9).
- Confirm the exception example in the README is a scoped `pathNot`/`comment` on one rule (not a whole-rule disable) and that following the documented protocol changes no application code under `src/`.
- Run `make lint-md` (Markdown lint) so the new README prose passes the repository's existing markdownlint gate.

### References

- Architecture: `## Core Architectural Decisions` → AD-8 "README 'Dependency Cruiser / Architecture rules' section + exception protocol" (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: `## Implementation Patterns & Consistency Rules` → "Process Patterns", "Communication Patterns", "Enforcement Guidelines" (MUST + Anti-Patterns) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: `## Core Architectural Decisions` → AD-6 "Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper" and `### Makefile lint-deps recipe (to be added)` for the exact commands and dual-mode `CI=1` behavior (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture: `## Project Structure & Boundaries` → "Requirements to File Mapping" (FR20/FR21/FR22 → `README.md`, AD-8) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics: `## Epic 6 Stories: Documentation` → "Story 6.2: Document make lint-deps usage and the exception protocol" (epics-dependency-cruiser-ci-2026-06-22.md).
- Epics: `### Additional Requirements (architecture-derived)` → AR8 "The exception protocol is a narrow, justified `pathNot`/`comment` addition scoped to the specific rule, reviewed in PR — never a whole-rule disable." (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD: FR22 (README documents `make lint-deps` usage and how to add a justified, scoped exception rather than disabling rules wholesale); supporting FR14 (`lint` aggregate + `make help`) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
