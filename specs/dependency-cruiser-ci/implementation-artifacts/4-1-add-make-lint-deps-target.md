# Story 4.1: Add the make lint-deps target and wire it into the lint aggregate

Status: ready-for-dev

## Story

As a developer,
I want a single `make lint-deps` command that runs dependency-cruiser over `src` and `tests`, included in `make lint`,
so that I can validate architecture boundaries locally before opening a PR and the standard lint pass covers it automatically.

## Acceptance Criteria

1. `DEPCRUISE_BIN = $(BIN_DIR)/depcruise` is declared in the Makefile alongside the existing per-tool `*_BIN` vars (FR13, NFR12).
2. The `lint-deps` target runs `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` and carries a trailing `## ` description comment (FR13).
3. With no flags `make lint-deps` executes inside the dev Docker container; with `CI=1` it executes `depcruise` directly on the runner (FR13, NFR8).
4. The aggregate line reads `lint: lint-next lint-tsc lint-md lint-deps` so `make lint` runs all four linters in sequence (FR14).
5. `make help` lists `lint-deps` via its trailing `## ` description comment (FR14).

## Tasks / Subtasks

- [ ] Task 1: Declare the `DEPCRUISE_BIN` variable in the Makefile (AC: 1)
  - [ ] 1.1 Add `DEPCRUISE_BIN = $(BIN_DIR)/depcruise` in the per-tool binary-variable block, alongside the existing `ESLINT_BIN`, `TS_BIN`, and `MARKDOWNLINT_BIN` declarations, so it resolves to `./node_modules/.bin/depcruise` via the observed `BIN_DIR = ./node_modules/.bin`.
  - [ ] 1.2 Follow the existing UPPER_SNAKE `*_BIN` naming convention exactly; do not introduce a `package.json` `scripts` entry (NFR12).
- [ ] Task 2: Add the `lint-deps` target (AC: 2, 3)
  - [ ] 2.1 Add the target alongside the existing `lint-next` / `lint-tsc` / `lint-md` targets.
  - [ ] 2.2 Set the recipe to `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` so the cruise targets are exactly `src tests` and read the root config (FR13).
  - [ ] 2.3 Carry a trailing `## ` description comment on the target line (e.g. `## Validate architecture/import boundaries with dependency-cruiser`) so the target self-documents into `make help` (AC 5).
  - [ ] 2.4 Rely on the existing `PNPM_EXEC` resolution (no per-target branching): with no flags `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`) runs it inside the dev container; with `CI=1` `PNPM_EXEC = pnpm` runs `depcruise` directly on the runner (FR13, NFR8).
- [ ] Task 3: Extend the `lint` aggregate (AC: 4)
  - [ ] 3.1 Change the existing aggregate line from `lint: lint-next lint-tsc lint-md` to `lint: lint-next lint-tsc lint-md lint-deps` so `make lint` runs all four linters in sequence (FR14).
  - [ ] 3.2 Preserve / update the aggregate's trailing `## ` description so `make help` still describes `lint` and now reflects that dependency-cruiser is included.
- [ ] Task 4: Validate the wiring (AC: 2, 3, 4, 5)
  - [ ] 4.1 Run `make help` and confirm `lint-deps` appears in the target listing via its trailing `## ` description (AC 5).
  - [ ] 4.2 Run `make lint-deps CI=1` and confirm it invokes `depcruise src tests --config .dependency-cruiser.js` directly on the host and returns a zero-violation, zero-exit result on current `main` (NFR9).
  - [ ] 4.3 Run `make lint-deps` (no flags) and confirm it executes inside the dev container via `PNPM_EXEC` (FR13, NFR8).
  - [ ] 4.4 Run `make lint` and confirm `lint-next`, `lint-tsc`, `lint-md`, and `lint-deps` all execute in sequence (FR14).

## Dev Notes

### Architecture Decisions

This story implements the Makefile-integration half of AD-6 (Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper) — specifically the `DEPCRUISE_BIN` variable, the `lint-deps` target, and the extended `lint` aggregate (from architecture-dependency-cruiser-ci-2026-06-22.md). The DIND wrapper `run-deps-lint-tests-dind` is the sibling of AD-6 carved out into Story 4.2 and is NOT in scope here.

AD-6 specifies (from architecture-dependency-cruiser-ci-2026-06-22.md): add `DEPCRUISE_BIN = $(BIN_DIR)/depcruise`; a `lint-deps` target that runs `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js`; and extend the aggregate to `lint: lint-next lint-tsc lint-md lint-deps`. `PNPM_EXEC` gives the exact dual-mode behavior of every other lint target — it runs inside the dev Docker container by default and directly on the runner when `CI=1` — and the trailing `## description` makes the target appear in `make help`.

Drop in verbatim (from architecture-dependency-cruiser-ci-2026-06-22.md, "Makefile `lint-deps` recipe (to be added)"):

```makefile
# --- variable, alongside the existing per-tool *_BIN vars ---
DEPCRUISE_BIN               = $(BIN_DIR)/depcruise

# --- target, alongside lint-next / lint-tsc / lint-md ---
lint-deps: ## Validate architecture/import boundaries with dependency-cruiser
	$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js

# --- aggregate (extend the existing line) ---
lint: lint-next lint-tsc lint-md lint-deps ## Runs all linters: ESLint, TypeScript, Markdown, and dependency-cruiser in sequence.
```

Key correctness notes (from architecture-dependency-cruiser-ci-2026-06-22.md, Technical Constraints & Dependencies and Implementation Patterns):

- Observed Makefile conventions this story conforms to: `BIN_DIR = ./node_modules/.bin`; per-tool BIN vars (`ESLINT_BIN`, `TS_BIN`, `MARKDOWNLINT_BIN`); `CI ?= 0` with `1/true/TRUE` normalized to `1`; when `CI=1`, `PNPM_EXEC = pnpm` (runs directly on the runner) else `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`); `.DEFAULT_GOAL = help`; `make help` lists targets carrying a trailing `## description`; the existing aggregate is `lint: lint-next lint-tsc lint-md`; individual lint targets call `$(PNPM_EXEC) $(TOOL_BIN)`.
- The recipe uses `$(PNPM_EXEC) $(DEPCRUISE_BIN)` — never a `package.json` `scripts` entry — because the Makefile is the single task runner (NFR12, Architectural Principle 6 / Enforcement Guidelines).
- The cruise targets are exactly `src tests` (Structure Patterns); `src/test/*` is covered because it lives under `src`, and the top-level `tests/` dir is covered as a separate cruise target.
- Naming follows the conventions in the Naming Patterns section: `DEPCRUISE_BIN` is UPPER_SNAKE per the `*_BIN` convention; `lint-deps` is kebab-case per the existing target convention.

### Project Structure Notes

- Modify: `Makefile` (repository root) — (1) add the `DEPCRUISE_BIN = $(BIN_DIR)/depcruise` variable in the per-tool `*_BIN` block; (2) add the `lint-deps` target with its trailing `## ` description and `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js` recipe; (3) extend the existing aggregate line to `lint: lint-next lint-tsc lint-md lint-deps`. This is the only file changed by this story.
- Prerequisite (not in scope here): the `.dependency-cruiser.js` config (skeleton + `options` from Story 1.2, rules from Epics 2 and 3) and the `dependency-cruiser` devDependency (Story 1.1) must already exist so that `make lint-deps` can run against a complete config and an installed `depcruise` binary. This story only wires the runner; it does not author the config.
- Out of scope: the `run-deps-lint-tests-dind` DIND wrapper is Story 4.2; the dedicated `dependency-cruiser.yml` workflow is Epic 5.
- Not touched: no file under `src/`, `pages/`, `package.json`, `.dependency-cruiser.js`, `.github/workflows/`, or `README.md` is modified by this story (additive, zero-blast-radius governance — Architectural Principles).
- Planning-artifacts-only: this story file describes the change; it does not itself edit the `Makefile` or any real repo file (AR9).

### Testing Approach

This is build/tooling wiring, not application code, so validation is by running `make`, not by unit tests:

- `make help` lists `lint-deps` via its trailing `## ` description (AC 5) — confirms the help auto-discovery convention picks up the new target.
- `make lint-deps CI=1` runs `depcruise src tests --config .dependency-cruiser.js` directly on the runner (`PNPM_EXEC = pnpm`) and returns zero violations / zero exit on current `main` (AC 2, 3; NFR9). The graph is clean today, so the gate is green on introduction.
- `make lint-deps` with no flags runs the same command inside the dev container via `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (AC 3, NFR8) — confirms the dual-mode `PNPM_EXEC` behavior matches the other lint targets.
- `make lint` executes `lint-next`, `lint-tsc`, `lint-md`, and `lint-deps` in sequence (AC 4, FR14) — confirms the aggregate extension.
- CI: the dedicated `dependency-cruiser.yml` workflow (Epic 5) invokes `make lint-deps CI=1`, and `lint-deps` also rides `static-testing.yml` through the `make lint` aggregate; both mechanisms coexist safely (AD-7 / FR23). An `error`-severity violation becomes a failed required check (FR17, NFR6).

### References

- Architecture — Core Architectural Decisions, AD-6 (Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper) and the "Makefile `lint-deps` recipe (to be added)" code block (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Technical Constraints & Dependencies (observed Makefile: `BIN_DIR`, per-tool `*_BIN`, `CI ?= 0`, `PNPM_EXEC`, `.DEFAULT_GOAL = help`, existing `lint: lint-next lint-tsc lint-md` aggregate) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Implementation Patterns & Consistency Rules: Naming Patterns (`DEPCRUISE_BIN`, `lint-deps`), Structure Patterns (cruise targets `src tests`), Process Patterns (`make lint-deps` local vs `CI=1`; `make lint` runs all four) and Enforcement Guidelines (invoke only through the Makefile, no `package.json` `scripts`) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Project Structure & Boundaries: Integration Points (Makefile `lint` aggregate) and Requirements to File Mapping (FR13/FR14 row) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics — Epic 4 Stories: Story 4.1 "Add the make lint-deps target and wire it into the lint aggregate" (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD — Functional Requirements FR13 (`make lint-deps` over `src`/`tests` via `PNPM_EXEC`) and FR14 (`lint` aggregate + `make help`); NFR8 (Node `>=20`, `pnpm@10.6.5`, `CI=1` / `PNPM_EXEC`), NFR12 (website naming/structure conventions; no `package.json` `scripts`) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
