# Story 4.2: Add the run-deps-lint-tests-dind wrapper

Status: ready-for-dev

## Story

As a CI maintainer,
I want a DIND wrapper that runs `make lint-deps CI=1` inside a test container,
so that dependency-cruiser has the same in-container execution parity as the existing ESLint DIND wrapper.

## Acceptance Criteria

1. `run-deps-lint-tests-dind` mirrors the `run-eslint-tests-dind` pattern, requires `TEMP_CONTAINER_NAME`, and runs `cd /app && make lint-deps CI=1` inside the container (FR15, NFR11).
2. Invoked without `TEMP_CONTAINER_NAME`, the wrapper fails with the standard required-env-var error used by the sibling DIND wrappers (FR15).
3. The wrapper carries a trailing `## ...` description so it appears in `make help` (FR15, NFR12).

## Tasks / Subtasks

- [ ] Task 1: Add the `run-deps-lint-tests-dind` target to the `Makefile` (AC: 1, 3)
  - [ ] 1.1 Place the target in the DIND-wrapper block alongside `run-eslint-tests-dind`, `run-typescript-tests-dind`, and `run-markdown-lint-tests-dind`, preserving the existing grouping and ordering.
  - [ ] 1.2 Give it a trailing `## Run dependency-cruiser tests in DIND container (TEMP_CONTAINER_NAME required)` description so `.DEFAULT_GOAL = help` / `make help` lists it (NFR12).
  - [ ] 1.3 As the first recipe line, call `$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)` — the same macro and example value the sibling wrappers use.
  - [ ] 1.4 Add an `@echo "🔍 Running dependency-cruiser in container $(TEMP_CONTAINER_NAME)..."` line matching the sibling wrappers' status-echo style.
  - [ ] 1.5 As the final recipe line, call `$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-deps CI=1)` so the cruiser runs directly on the container runner (`CI=1` → `PNPM_EXEC = pnpm`) (AC: 1).
- [ ] Task 2: Confirm the required-env-var failure path (AC: 2)
  - [ ] 2.1 Verify that invoking `make run-deps-lint-tests-dind` with no `TEMP_CONTAINER_NAME` set prints `Error: TEMP_CONTAINER_NAME is required. Usage: make run-deps-lint-tests-dind TEMP_CONTAINER_NAME=my-container` and exits non-zero, via the shared `REQUIRE_ENV_VAR` macro.
- [ ] Task 3: Validate help discoverability and parity (AC: 1, 3)
  - [ ] 3.1 Run `make help` and confirm `run-deps-lint-tests-dind` appears with its description.
  - [ ] 3.2 Diff the new target against `run-eslint-tests-dind` line-for-line to confirm it mirrors the pattern exactly (macro call, echo, exec), differing only in the inner `make lint-deps CI=1` target and the echo/description wording (NFR11).
- [ ] Task 4: End-to-end DIND validation (AC: 1, 2)
  - [ ] 4.1 With a temp container provisioned (per the existing `*-dind` setup targets), set `TEMP_CONTAINER_NAME` and run `make run-deps-lint-tests-dind`; confirm `make lint-deps CI=1` executes inside the container and exits zero on the clean `main` graph.

## Dev Notes

### Architecture Decisions

This wrapper is the FR15 deliverable of AD-6 (Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper) (from architecture-dependency-cruiser-ci-2026-06-22.md). AD-6 states: "add `run-deps-lint-tests-dind -> make lint-deps CI=1` mirroring `run-eslint-tests-dind`" and that "The DIND wrapper preserves in-container parity with the other linters." It is purely additive Makefile wiring; no `src/` code and no application behavior changes.

Drop in verbatim (from architecture-dependency-cruiser-ci-2026-06-22.md, "Makefile `lint-deps` recipe (to be added)"):

```makefile
# --- DIND wrapper, mirroring run-eslint-tests-dind ---
run-deps-lint-tests-dind: ## Run dependency-cruiser tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running dependency-cruiser in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-deps CI=1)
```

Key correctness / parity notes (from architecture-dependency-cruiser-ci-2026-06-22.md and the observed `Makefile`):

- The wrapper is a 1:1 structural mirror of the existing `run-eslint-tests-dind` target. The observed sibling is:

  ```makefile
  run-eslint-tests-dind: ## Run ESLint tests in DIND container (TEMP_CONTAINER_NAME required)
  	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
  	@echo "🔍 Running ESLint in container $(TEMP_CONTAINER_NAME)..."
  	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-next CI=1)
  ```

  The only differences are the target name, the echo/description wording, and the inner target (`make lint-deps CI=1` instead of `make lint-next CI=1`) — this is exactly the NFR11 CRM/sibling parity requirement.
- `REQUIRE_ENV_VAR` is the shared macro (Makefile lines 59–64): `@if [ -z "$($(1))" ]; then echo "Error: $(1) is required. Usage: make $(MAKECMDGOALS) $(1)=$(2)"; exit 1; fi`. Passing `TEMP_CONTAINER_NAME` and the example value `my-container` produces the standard required-env-var error and a non-zero exit (AC 2) — identical to every other `*-dind` wrapper, so no bespoke error handling is introduced.
- `EXEC_IN_CONTAINER` is the shared macro (Makefile lines 67–69): `docker exec "$($(1))" sh -lc "$(2)"`. The `cd /app && make lint-deps CI=1` command runs inside the named container; `CI=1` forces `PNPM_EXEC = pnpm` so `depcruise` runs directly on the container's runner (not via `docker compose exec`), matching the in-container execution model of the other linter wrappers (NFR8).
- The trailing `## ...` comment is required for the target to appear in `make help` (`.DEFAULT_GOAL = help` lists targets carrying a trailing `## description`) (FR15, NFR12).
- This wrapper depends on the `lint-deps` target from Story 4.1 already existing; `run-deps-lint-tests-dind` only invokes `make lint-deps CI=1` — it does not re-implement the cruise command.

### Project Structure Notes

- Modify: `Makefile` (repository root) — add the `run-deps-lint-tests-dind` target in the DIND-wrapper block next to `run-eslint-tests-dind` / `run-typescript-tests-dind` / `run-markdown-lint-tests-dind`. This is the only file changed by this story.
- Prerequisite (not in scope here): the `DEPCRUISE_BIN` variable and the `lint-deps` target (and its inclusion in the `lint` aggregate) from Story 4.1 must already exist; this wrapper calls `make lint-deps CI=1` and relies on the shared `REQUIRE_ENV_VAR` / `EXEC_IN_CONTAINER` macros that already exist in the Makefile.
- Reuses (no change): the existing `REQUIRE_ENV_VAR` and `EXEC_IN_CONTAINER` macros and the `TEMP_CONTAINER_NAME` convention shared by all `*-dind` targets.
- Not touched: no file under `src/`, `pages/`, `package.json`, `.dependency-cruiser.js`, `.github/workflows/`, or `README.md` is modified by this story (additive, zero-blast-radius governance — Architectural Principles).
- Planning-artifacts-only: this story file describes the change; it does not itself edit the `Makefile` or any real repo file (AR9).

### Testing Approach

This is build-tooling (Makefile) wiring, not application code, so validation is by running `make`, not by unit tests:

- Discoverability: run `make help` and confirm `run-deps-lint-tests-dind` is listed with its `## ...` description (AC 3, FR15, NFR12).
- Required-env-var failure: invoke `make run-deps-lint-tests-dind` with `TEMP_CONTAINER_NAME` unset and confirm it prints the standard `Error: TEMP_CONTAINER_NAME is required. Usage: ...` message and exits non-zero, identical to the sibling wrappers (AC 2, FR15).
- Parity check: diff the new target against `run-eslint-tests-dind` and confirm only the name, echo/description wording, and inner `make lint-deps CI=1` target differ (AC 1, NFR11).
- End-to-end: with a provisioned temp container and `TEMP_CONTAINER_NAME` set, run `make run-deps-lint-tests-dind` and confirm `cd /app && make lint-deps CI=1` runs inside the container and exits zero on the clean `main` graph (AC 1).
- This wrapper is a developer/CI convenience for in-container parity; the authoritative PR gate remains the dedicated `dependency-cruiser.yml` workflow (Epic 5), which runs `make lint-deps CI=1` directly on the runner.

### References

- Architecture — Core Architectural Decisions, AD-6 (Makefile integration via `PNPM_EXEC` + `lint` aggregate + DIND wrapper): "add `run-deps-lint-tests-dind -> make lint-deps CI=1` mirroring `run-eslint-tests-dind`" / "preserves in-container parity" (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — "Makefile `lint-deps` recipe (to be added)": the verbatim `run-deps-lint-tests-dind` block (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Technical Constraints & Dependencies: observed Makefile conventions (`CI ?= 0`; `CI=1` → `PNPM_EXEC = pnpm`; `.DEFAULT_GOAL = help`; trailing `##`; existing DIND wrappers `run-eslint-tests-dind -> make lint-next CI=1`) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Implementation Patterns & Consistency Rules: Naming Patterns (`run-deps-lint-tests-dind` kebab-case target) and Process Patterns (`make lint-deps CI=1` host execution) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Blast-Radius Inventory / Complete File Change Map: `Makefile [MODIFY]` adds the DIND wrapper; no `src/` change (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics — Epic 4 Stories: Story 4.2 "Add the run-deps-lint-tests-dind wrapper" (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD — Functional Requirement FR15 (`run-deps-lint-tests-dind` DIND wrapper); NFR8 (`CI=1` / `PNPM_EXEC` execution), NFR11 (mirror CRM Makefile conventions / DIND wrapper), NFR12 (follow website naming/structure conventions; Makefile is the task runner) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
