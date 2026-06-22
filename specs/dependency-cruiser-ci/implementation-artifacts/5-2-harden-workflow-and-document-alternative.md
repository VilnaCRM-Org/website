# Story 5.2: Harden workflow permissions and document the static-testing alternative

Status: ready-for-dev

## Story

As a security-conscious CI maintainer,
I want the workflow to run with least-privilege permissions and a SHA-pinned checkout, and the design to record why the dedicated workflow is preferred over riding the lint gate,
so that the gate is supply-chain-hardened and future maintainers understand the authoritative-gate decision.

## Acceptance Criteria

1. The workflow sets least-privilege permissions: `contents: read` at the appropriate scope (FR19).
2. The checkout step uses a SHA-pinned `actions/checkout` (`b4ffde65f46336ab88eb53be808477a3936bae11`, v4.1.1) with `persist-credentials: false` (FR19).
3. The design documents that `lint-deps` already runs inside `static-testing.yml` via the `make lint` aggregate, that both mechanisms coexist safely, and recommends the dedicated workflow as the authoritative gate for CRM parity and isolated failure reporting (FR23).
4. The workflow filename, name, and shape mirror the CRM `dependency-cruiser.yml` and the website's existing 18 workflows (NFR11, NFR12).

## Tasks / Subtasks

- [ ] Task 1: Declare least-privilege permissions on `.github/workflows/dependency-cruiser.yml` (AC: 1, 4)
  - [ ] 1.1 Add a top-level `permissions:` block with exactly `contents: read`, placed after `on:` and before `jobs:`, matching the embedded workflow in the architecture's `.github/workflows/dependency-cruiser.yml`.
  - [ ] 1.2 Confirm no broader scopes (`write`, `pull-requests`, `id-token`, etc.) are granted anywhere in the workflow — the gate only reads the repository to build the import graph (NFR no-network / read-only analysis).
  - [ ] 1.3 Keep the workflow `name: dependency cruiser` and the filename `dependency-cruiser.yml` so the name/filename/shape match CRM and the website's existing 18 workflows (NFR11, NFR12).
- [ ] Task 2: Harden the checkout step (AC: 2, 4)
  - [ ] 2.1 Set the checkout `uses:` to the SHA pin `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1` (supply-chain pinning, not a floating tag).
  - [ ] 2.2 Add `with: { persist-credentials: false }` so the `GITHUB_TOKEN` is not written to the runner's git config after checkout.
  - [ ] 2.3 Confirm the step name is `Checkout code`, consistent with the architecture's embedded workflow and the sibling website workflows.
- [ ] Task 3: Record the FR23 static-testing alternative and authoritative-gate decision (AC: 3)
  - [ ] 3.1 In the PR description and/or the README CI note, state that because `lint-deps` is in the `lint` aggregate (`lint: lint-next lint-tsc lint-md lint-deps`), it already runs inside `static-testing.yml` via `make lint`.
  - [ ] 3.2 State that both mechanisms coexist safely (no conflict; running the cruise twice is harmless and deterministic — NFR3).
  - [ ] 3.3 Recommend the dedicated `dependency-cruiser.yml` as the authoritative gate for (a) CRM parity (CRM ships its own `dependency-cruiser.yml`) and (b) isolated failure reporting — an architecture violation surfaces as its own failed required check rather than buried in the omnibus lint job (FR23, AD-7).
- [ ] Task 4: Validate the hardened workflow (AC: 1, 2, 4)
  - [ ] 4.1 Lint the workflow YAML (the repo's `make lint-md` / actionlint path, if wired) and confirm it parses; confirm `permissions: contents: read` and the SHA-pinned `persist-credentials: false` checkout are present.
  - [ ] 4.2 Open the introducing PR and confirm the `dependency cruiser` check runs as its own required check with read-only token scope and passes green on the clean graph (NFR9).
  - [ ] 4.3 Diff the workflow shape against a sibling website workflow (e.g. `static-testing.yml`) to confirm trigger, `setup-node`, pnpm cache, and step naming conventions match (NFR11, NFR12).

## Dev Notes

### Architecture Decisions

This story hardens the dedicated workflow authored in Story 5.1 and records the FR23 alternative. It implements the supply-chain and least-privilege portions of **AD-7: Dedicated CI workflow `dependency-cruiser.yml` (recommended over riding `static-testing.yml`)** (from architecture-dependency-cruiser-ci-2026-06-22.md). The workflow declares `permissions: contents: read`, uses a SHA-pinned `actions/checkout` with `persist-credentials: false`, and is the **authoritative gate**. AR7 fixes the exact pins: `actions/checkout` at commit `b4ffde65f46336ab88eb53be808477a3936bae11` (v4.1.1).

The two changes this story owns are the `permissions:` block and the hardened checkout step within the embedded `.github/workflows/dependency-cruiser.yml` (from architecture-dependency-cruiser-ci-2026-06-22.md, `.github/workflows/dependency-cruiser.yml`):

```yaml
permissions:
  contents: read
```

```yaml
- name: Checkout code
  uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
  with:
    persist-credentials: false
```

For context, the complete embedded workflow these snippets belong to (from architecture-dependency-cruiser-ci-2026-06-22.md):

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

Key correctness and rationale notes (from architecture-dependency-cruiser-ci-2026-06-22.md):

- **Least privilege (FR19).** The cruise only reads the source tree to build the import graph — it never pushes, comments, or requests tokens. `permissions: contents: read` at the top level grants the whole workflow a read-only `GITHUB_TOKEN`. This is the same hardening the architecture's Architecture Completeness Checklist calls out ("least-privilege permissions") and the Data Flow diagram annotates as `checkout(SHA-pinned, no creds)`.
- **SHA-pinned checkout + no persisted credentials (FR19).** Pinning `actions/checkout` to the full commit SHA (`b4ffde65f...`, v4.1.1) rather than a floating `@v4` tag closes the tag-repoint supply-chain vector; `persist-credentials: false` prevents the token from lingering in the runner's git config after checkout. AR7 enumerates these exact pins.
- **FR23 — alternative documented, dedicated workflow recommended.** Because `lint-deps` is in the `lint` aggregate (AD-6), `make lint` inside `static-testing.yml` already runs the cruise. Both mechanisms coexist safely (deterministic, no side effects — NFR3). The dedicated workflow is nonetheless the **authoritative gate** for (a) CRM parity and (b) isolated failure reporting, so an architecture violation is its own failed required check rather than buried in the omnibus lint job (AD-7 Rationale).
- **Shape parity (NFR11, NFR12).** Filename `dependency-cruiser.yml`, workflow `name: dependency cruiser`, `pull_request -> branches:[main]` trigger, `setup-node` at `${{ vars.NODE_VERSION }}`, and the pnpm cache all mirror CRM's `dependency-cruiser.yml` and the website's existing 18 workflows (all on `pull_request -> branches:[main]`). The Naming Patterns section fixes the kebab-case workflow filename.

### Project Structure Notes

- Modify: `.github/workflows/dependency-cruiser.yml` — add the top-level `permissions: contents: read` block and harden the `Checkout code` step (SHA-pinned `actions/checkout` + `persist-credentials: false`). This is the only workflow file touched by this story.
- Document (FR23): the authoritative-gate / static-testing-alternative rationale is recorded in the PR description and, where the README CI usage is added (Epic 6), as a short note that the dedicated workflow is the authoritative gate while `make lint` in `static-testing.yml` also exercises the cruise. No new file is created by this story for the FR23 note beyond the existing workflow + PR/README surfaces.
- Prerequisite (not in scope here): the dedicated `.github/workflows/dependency-cruiser.yml` from Story 5.1 (trigger, `env: CI: 1`, `setup-node`, pnpm cache, `make install`, `make lint-deps CI=1`) must already exist; this story slots the `permissions` block and checkout hardening into that file. The Makefile `lint-deps` target and the `lint` aggregate (Epic 4) underpin the FR23 coexistence claim.
- Not touched: no file under `src/`, `pages/`, `package.json`, `.dependency-cruiser.js`, or the `Makefile` is modified by this story (additive, zero-blast-radius governance — Architectural Principles).
- Planning-artifacts-only: this story file describes the change; it does not itself edit `dependency-cruiser.yml`, the README, or any real repo file (AR9).

### Testing Approach

This is CI configuration, not application code, so validation is by running/inspecting the workflow, not by unit tests:

- Static validation: parse/lint the workflow YAML (the repo's markdown/actionlint path if wired) and visually confirm `permissions: contents: read`, the SHA-pinned `actions/checkout@b4ffde65f...`, and `persist-credentials: false` are present and correctly scoped (AC 1, 2).
- Shape parity check: diff the workflow against a sibling website workflow (e.g. `static-testing.yml`) to confirm the trigger, `setup-node`, pnpm cache, and step-name conventions match, and confirm filename `dependency-cruiser.yml` + `name: dependency cruiser` match CRM (AC 4, NFR11, NFR12).
- Live check on the introducing PR: confirm the `dependency cruiser` check runs as its own required check with a read-only token and passes green on the clean graph (target under ~30 s — NFR1, NFR9).
- Determinism: the same commit yields the same pass/fail regardless of whether the cruise is reached via this workflow or via `make lint` in `static-testing.yml`, confirming the two mechanisms coexist safely (FR23, NFR3).

### References

- Architecture — Core Architectural Decisions, AD-7 "Dedicated CI workflow `dependency-cruiser.yml` (recommended over riding `static-testing.yml`)" — Decision (permissions, SHA-pinned checkout, `persist-credentials: false`) and Rationale / FR23 alternative (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — `.github/workflows/dependency-cruiser.yml` embedded block (`permissions: contents: read`; `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1` with `persist-credentials: false`) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Implementation Patterns & Consistency Rules: Naming Patterns (workflow filename `dependency-cruiser.yml`) and Process Patterns (dedicated workflow runs on PR to `main`) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Architecture — Project Structure & Boundaries: Data Flow (`checkout(SHA-pinned, no creds)`) and Integration Points (GitHub Actions required checks); Architecture Completeness Checklist (least-privilege permissions; FR23 alternative documented) (architecture-dependency-cruiser-ci-2026-06-22.md).
- Epics — Additional Requirements AR7 (exact SHA pin and workflow shape); Epic 5 Stories: Story 5.2 "Harden workflow permissions and document the static-testing alternative" (epics-dependency-cruiser-ci-2026-06-22.md).
- PRD — Functional Requirements FR19 (`permissions: contents: read`, SHA-pinned checkout, `persist-credentials: false`) and FR23 (document alternative; recommend dedicated workflow); NFR11 (CRM parity / workflow shape), NFR12 (website naming/structure conventions) (prd-dependency-cruiser-ci-2026-06-22.md).

## Dev Agent Record

### Agent Model Used

_TBD — not yet implemented_

### Debug Log References

_None yet._

### Completion Notes List

_None yet._

### File List

_None yet._
