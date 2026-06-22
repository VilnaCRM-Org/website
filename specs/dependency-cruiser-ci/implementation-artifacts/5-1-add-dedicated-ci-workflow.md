# Story 5.1: Add the dedicated dependency-cruiser CI workflow

Status: ready-for-dev

## Story

As a CI maintainer,
I want a dedicated workflow that runs dependency-cruiser automatically on every PR to main and fails on any error-severity violation,
so that architecture-boundary violations are blocked at PR time as their own isolated required check.

## Acceptance Criteria

1. `dependency-cruiser.yml` triggers on `pull_request` with `branches: [main]` and sets `env: CI: 1` (FR16).
2. The job sets up Node via `actions/setup-node@v4` at `node-version: ${{ vars.NODE_VERSION }}`, caches pnpm via `actions/cache@v4.2.3` keyed on `pnpm-lock.yaml`, installs pnpm via `npm install -g pnpm`, runs `make install` (conditional on cache miss), then `make lint-deps CI=1` (FR18, NFR8).
3. Given a PR that introduces any error-severity violation, `make lint-deps CI=1` exits non-zero and the required check fails (FR17, NFR6).
4. Given a PR with only warn-severity findings or none, the check passes (NFR6).
5. Against the introducing PR itself (clean graph on main), the workflow completes well within the static-testing budget (target under ~30 s) and passes green (NFR1, NFR9).

## Tasks / Subtasks

- [ ] Task 1: Add the dedicated workflow file `.github/workflows/dependency-cruiser.yml` (AC: 1, 2)
  - [ ] 1.1 Set `name: dependency cruiser`.
  - [ ] 1.2 Configure the trigger as `on: pull_request:` with `branches: - main`.
  - [ ] 1.3 Define a single job `dependency-cruiser` on `runs-on: ubuntu-latest` with `env: CI: 1` at the job scope.
- [ ] Task 2: Author the job steps in the exact `static-testing.yml`-parity order (AC: 2)
  - [ ] 2.1 Checkout step using `actions/checkout` (SHA-pinned, `persist-credentials: false` — hardening detailed in Story 5.2).
  - [ ] 2.2 `Set up Node.js` step via `actions/setup-node@v4` with `node-version: ${{ vars.NODE_VERSION }}`.
  - [ ] 2.3 `Cache pnpm dependencies` step via `actions/cache@v4.2.3`, `path: node_modules`, `key: ${{ runner.os }}-dependencies-${{ hashFiles('**/pnpm-lock.yaml') }}` with `restore-keys: ${{ runner.os }}-dependencies-`, and `id: cache-pnpm-dependencies`.
  - [ ] 2.4 `Install pnpm` step running `npm install -g pnpm`.
  - [ ] 2.5 `Install dependencies` step running `make install`, guarded by `if: steps.cache-pnpm-dependencies.outputs.cache-hit != 'true'`.
  - [ ] 2.6 `Validate architecture boundaries` step running `make lint-deps CI=1`.
- [ ] Task 3: Verify failure semantics — error fails, warn passes (AC: 3, 4)
  - [ ] 3.1 Confirm `make lint-deps CI=1` propagates the `depcruise` non-zero exit so any `error`-severity violation fails the required check.
  - [ ] 3.2 Confirm a graph with only `warn`-severity findings (or none) exits 0 and the check passes.
- [ ] Task 4: Validate against the introducing PR (AC: 5)
  - [ ] 4.1 Run `make lint-deps CI=1` locally on the current branch (clean `main`) and confirm zero violations.
  - [ ] 4.2 Confirm the workflow run completes under the ~30 s static-testing budget and reports green.
  - [ ] 4.3 Confirm the new check is registered so it can be marked a required check on `main`.

## Dev Notes

### Architecture Decisions

The dedicated workflow is **AD-7** (from `architecture-dependency-cruiser-ci-2026-06-22.md`): a `.github/workflows/dependency-cruiser.yml` on `pull_request -> branches:[main]` with `permissions: contents: read`, a SHA-pinned `actions/checkout` (`persist-credentials: false`), `setup-node` at `node-version: ${{ vars.NODE_VERSION }}`, pnpm cache, `Install pnpm` (`npm install -g pnpm`), `make install`, then `make lint-deps CI=1` (FR16, FR17, FR18, FR19).

**FR23 rationale / alternative (from AD-7):** Because `lint-deps` is in the `lint` aggregate, it would *already* run inside `static-testing.yml` (`make lint`). Both mechanisms coexist safely. The dedicated workflow is nonetheless **recommended and authoritative** for (a) CRM parity — CRM ships its own `dependency-cruiser.yml` — and (b) isolated failure reporting: an architecture violation surfaces as its own failed required check rather than being buried in the omnibus lint job. (The permission hardening and the explicit FR23 documentation are completed in Story 5.2; this story stands up the workflow and its execution steps.)

**Drop-in workflow (from architecture `### .github/workflows/dependency-cruiser.yml (to be added)`):**

```yaml
name: dependency cruiser
on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  dependency-cruiser:
    runs-on: ubuntu-latest
    env:
      CI: 1
    steps:
      - name: Checkout code
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          persist-credentials: false

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ vars.NODE_VERSION }}

      - name: Cache pnpm dependencies
        id: cache-pnpm-dependencies
        uses: actions/cache@v4.2.3
        with:
          path: node_modules
          key: ${{ runner.os }}-dependencies-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-dependencies-

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: make install
        if: steps.cache-pnpm-dependencies.outputs.cache-hit != 'true'

      - name: Validate architecture boundaries
        run: make lint-deps CI=1
```

**Failure semantics (from architecture `### Data Flow` and AD-7):** `make lint-deps CI=1` sets `PNPM_EXEC = pnpm` so `depcruise src tests --config .dependency-cruiser.js` runs directly on the runner; any `error`-severity violation yields a non-zero exit and a failed required check (FR17, NFR6), while a `warn`-only graph exits 0 and the check passes (NFR6).

**Performance / clean-graph note (from architecture NFR1, NFR9):** the graph is clean on `main` today (zero cross-feature imports, no cycles, PascalCase dirs not flagged), so the gate is expected green on introduction; `skipAnalysisNotInRules: true` plus `doNotFollow: ['node_modules']` keep the cruise under the ~30 s budget with no app build (NFR2) and no network (NFR5).

### Project Structure Notes

Files to **add**:

- `.github/workflows/dependency-cruiser.yml` — new dedicated required-check workflow (PR -> main): SHA-pinned checkout + `setup-node` (`${{ vars.NODE_VERSION }}`) + pnpm cache + `npm install -g pnpm` + conditional `make install` + `make lint-deps CI=1`.

Files **referenced but not modified** by this story:

- `Makefile` — provides the `lint-deps` target invoked as `make lint-deps CI=1` (added in Story 4.1; not edited here).
- `static-testing.yml` — the observed parity template for trigger, `env: CI: 1`, `setup-node`, and pnpm cache shape (read-only reference).
- `.dependency-cruiser.js` — the config the target consumes (Epics 1–3; not edited here).

No file under `src/` is touched (NFR9). The dependent target `make lint-deps` and the `.dependency-cruiser.js` config are assumed present from Epics 1–4; this story wires only the dedicated CI workflow. The permission-hardening attributes shown in the YAML (`permissions: contents: read`, SHA-pinned checkout, `persist-credentials: false`) are formally owned by Story 5.2 (FR19).

### Testing Approach

This is CI/tooling configuration, validated via dry-run and CI rather than unit tests:

- Validate the workflow YAML parses and the job/step shape matches the drop-in (e.g. `actionlint` and a manual diff against the architecture block).
- Locally run `make lint-deps CI=1` on the current branch to confirm a clean graph (zero violations) and sub-~30 s runtime (AC 5).
- On the introducing PR, confirm the `dependency cruiser` check runs, completes within the static-testing budget, and reports green (AC 5).
- Confirm failure behavior by reasoning over / spot-checking that an injected `error`-severity violation produces a non-zero exit and a red check, while a `warn`-only graph stays green (AC 3, AC 4) — exercised through the `.dependency-cruiser.js` rule severities, not a code change to `src/`.

### References

- Architecture `## Core Architectural Decisions -> ### AD-7: Dedicated CI workflow dependency-cruiser.yml` (from `architecture-dependency-cruiser-ci-2026-06-22.md`).
- Architecture `## Project Structure & Boundaries -> ### .github/workflows/dependency-cruiser.yml (to be added)` (drop-in YAML) and `### Data Flow` (failure semantics).
- Architecture `## Project Structure & Boundaries -> ### Integration Points` (GitHub Actions required checks) and `### Requirements to File Mapping` (FR16–FR19/FR23 -> workflow).
- Architecture `### Architectural Principles` (additive, zero-blast-radius governance; clean graph -> green gate) and `## Project Context Analysis -> ### Technical Constraints & Dependencies` (`static-testing.yml` observed shape).
- Epics `## Epic 5 Stories: CI Enforcement -> ### Story 5.1: Add the dedicated dependency-cruiser CI workflow` (from `epics-dependency-cruiser-ci-2026-06-22.md`).
- PRD Functional Requirements **FR16** (dedicated workflow on PR -> main), **FR17** (fail on `error` violations), **FR18** (`${{ vars.NODE_VERSION }}`, pnpm, cache, `make install`, `make lint-deps CI=1`); Non-Functional **NFR1**, **NFR6**, **NFR8**, **NFR9** (from `prd-dependency-cruiser-ci-2026-06-22.md`).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
