# Story 1.1: Add dependency-cruiser devDependency at CRM-parity version

Status: done

## Story

As a CI maintainer,
I want `dependency-cruiser ^17.x` declared as a devDependency and installed through the existing pnpm / `make install` flow,
so that the website has the same architecture-governance tool at the same major version as the CRM sister repo.

## Acceptance Criteria

1. `package.json` declares `dependency-cruiser` under `devDependencies` with a `^17.x` range matching CRM's `^17.3.7` major (FR1, NFR11).
2. No `scripts` section is introduced into `package.json`; all task-running remains via the Makefile (NFR12).
3. Running `make install` with `pnpm@10.6.5` resolves and installs `dependency-cruiser`, updates the lockfile deterministically, and makes the `depcruise` binary available under `./node_modules/.bin/` (FR1, NFR8).
4. No file under `src/` is touched by this change (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add the `dependency-cruiser` devDependency at CRM-parity major (AC: 1, 2)
  - [x] 1.1 Add `dependency-cruiser` under `devDependencies` in `package.json` with a `^17.x` range that matches CRM's `^17.3.7` major (e.g. `"dependency-cruiser": "^17.3.7"`).
  - [x] 1.2 Confirm the addition is the only change to `package.json` and that NO `scripts` section is introduced — the tool is invoked exclusively through the Makefile (`$(PNPM_EXEC) $(DEPCRUISE_BIN)`), wired in a later story (Epic 4).
  - [x] 1.3 Keep the existing `packageManager: "pnpm@10.6.5"` pin unchanged so resolution is deterministic.
- [x] Task 2: Install through the existing pnpm / `make install` flow and update the lockfile (AC: 3)
  - [x] 2.1 Run `make install` so `pnpm@10.6.5` resolves `dependency-cruiser ^17.x` and updates `pnpm-lock.yaml` deterministically (reproducible local + CI per NFR3/NFR4/NFR8).
  - [x] 2.2 Verify the `depcruise` binary is present at `./node_modules/.bin/depcruise` (this is the binary the future `DEPCRUISE_BIN = $(BIN_DIR)/depcruise` Makefile variable will point at).
  - [x] 2.3 Verify the installed version satisfies the declared `^17.x` range (e.g. `./node_modules/.bin/depcruise --version` reports a `17.x` version).
- [x] Task 3: Verify zero blast radius (AC: 4)
  - [x] 3.1 Confirm no file under `src/` is added, modified, or deleted by this change.
  - [x] 3.2 Confirm the only touched files are `package.json` (devDeps) and `pnpm-lock.yaml`; `.dependency-cruiser.js`, the `Makefile`, and the workflow are intentionally NOT created in this story (they belong to Stories 1.2, 4.x, and 5.x).

## Dev Notes

### Architecture Decisions

- **Additive devDependency only — CRM tooling parity (from architecture-dependency-cruiser-ci-2026-06-22.md, AD-1 / Initialization Command).** `dependency-cruiser ^17.x` is added to `devDependencies` to mirror CRM's `^17.3.7` major (NFR11). The install is the only dependency change; the implementing command performed during a future implementation PR is:

  ```bash
  pnpm add -D dependency-cruiser@^17    # FR1 — matches CRM ^17.3.7 major
  make install                          # refresh node_modules / lockfile via existing flow
  ```

- **Makefile is the single task runner (from architecture-dependency-cruiser-ci-2026-06-22.md, Architectural Principle 6 / AD-6).** `package.json` has NO `scripts` section; the tool is invoked through `$(PNPM_EXEC) $(DEPCRUISE_BIN)` and never via npm scripts (NFR12). This story must not add a `scripts` block.
- **Binary location (from architecture-dependency-cruiser-ci-2026-06-22.md, AD-6 / Blast-Radius Inventory).** The Makefile observes `BIN_DIR = ./node_modules/.bin`; a later story adds `DEPCRUISE_BIN = $(BIN_DIR)/depcruise`. After install, the `depcruise` binary must therefore exist under `./node_modules/.bin/`.
- **Zero blast radius (from architecture-dependency-cruiser-ci-2026-06-22.md, Architectural Principle 1 / Blast-Radius Inventory).** No file under `src/` is touched; there is no behavioral change to the application. The dependency is inert until `make lint-deps` runs (added in Epic 4). The clean graph on `main` means the gate is expected green on introduction (NFR9).
- **Package manager / Node (from architecture-dependency-cruiser-ci-2026-06-22.md, Technical Constraints & Dependencies).** `pnpm@10.6.5`, Node `>=20` pinned via `${{ vars.NODE_VERSION }}` (NFR8). The existing `packageManager` pin in `package.json` (`pnpm@10.6.5`) drives deterministic resolution.

### Project Structure Notes

Files to modify in this story:

```text
package.json        [MODIFY] devDependencies += "dependency-cruiser": "^17.x"  (NO scripts section)
pnpm-lock.yaml      [MODIFY] regenerated deterministically by `make install`
```

Explicitly NOT touched by this story (handled by later stories):

```text
.dependency-cruiser.js                      (Story 1.2 — config skeleton + options)
Makefile                                    (Stories 4.1 / 4.2 — DEPCRUISE_BIN, lint-deps, DIND wrapper)
.github/workflows/dependency-cruiser.yml    (Stories 5.1 / 5.2 — dedicated CI gate)
README.md                                   (Stories 6.1 / 6.2 — rules + usage docs)
src/**                                      (UNCHANGED — no application code touched, NFR9)
```

### Testing Approach

This is a tooling/dependency change with no application code, so it is validated by install and CLI verification rather than unit tests:

- Run `make install` and confirm `pnpm@10.6.5` resolves and installs `dependency-cruiser ^17.x` with a deterministic lockfile update (NFR3, NFR4, NFR8).
- Confirm the `depcruise` binary is invokable at `./node_modules/.bin/depcruise` and reports a `17.x` version, satisfying the declared range (FR1, NFR11).
- Confirm via `git status` / diff that only `package.json` and `pnpm-lock.yaml` changed and nothing under `src/` was touched (NFR9).
- Full end-to-end CI validation (running the gate as a required check) is exercised by later stories once `.dependency-cruiser.js`, `make lint-deps`, and `dependency-cruiser.yml` exist (Stories 1.2, 4.x, 5.x).

### References

- Architecture: `architecture-dependency-cruiser-ci-2026-06-22.md` → AD-1 (Single CommonJS config), Initialization Command (brownfield — no new init), Blast-Radius Inventory, AD-6 (Makefile integration / `BIN_DIR`), Architectural Principles 1 & 6, Technical Constraints & Dependencies.
- Epics: `epics-dependency-cruiser-ci-2026-06-22.md` → Epic 1 (Tooling Foundation), Story 1.1.
- PRD: `prd-dependency-cruiser-ci-2026-06-22.md` → FR1; NFR8, NFR9, NFR11, NFR12.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added dependency-cruiser ^17.3.7 (resolved 17.4.3) to devDependencies and updated the lockfile.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `package.json`
- `pnpm-lock.yaml`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
