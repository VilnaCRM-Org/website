---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
inputDocuments:
  - specs/rust-code-analysis/planning-artifacts/prd-rust-code-analysis-2026-06-25.md
  - specs/rust-code-analysis/planning-artifacts/architecture-rust-code-analysis-2026-06-25.md
---

# website - Epic Breakdown

## Overview

This epic breakdown turns the Rust Code Analysis PRD (`prd-rust-code-analysis-2026-06-25.md`) and its companion architecture (`architecture-rust-code-analysis-2026-06-25.md`) into an implementable plan for adding Mozilla `rust-code-analysis` as a CI-enforced **code-complexity** quality gate to the VilnaCRM **website** repository. The work pins `rust-code-analysis-cli` to a single source-of-truth version (`RCA_VERSION = 0.0.25`) and provisions it as a SHA256-verified host binary at `./bin/rust-code-analysis-cli` (never an npm devDependency); commits a `config/metrics-policy.json` thresholds policy (plus a draft-07 `config/metrics-policy.schema.json`) ported from the CRM sister repo and re-baselined for the website, classifying every metric as a blocking **hard** threshold or a non-blocking **review** threshold; authors a host-only `scripts/ci/lint-metrics.sh` parse-and-enforce wrapper that turns the analyzer's emitted NDJSON into a pass/fail with collect-all-then-fail, actionable output (because `rust-code-analysis-cli` only emits metrics and never self-fails); wires a `make lint-metrics` target that runs on the host in both modes and is deliberately kept **out** of the `lint` aggregate and `CI_LINT_TARGETS` with **no** DinD wrapper; adds a dedicated `.github/workflows/rust-code-analysis.yml` that auto-runs on every pull request to `main`, installs the pinned CLI (no Node/pnpm/`make install`), and fails on any hard violation; verifies baseline compliance and registers `rust-code-analysis` as a required status check; and documents the rules, local usage, and budget-exception protocol in the README and CONTRIBUTING. The deliverable is additive, low-blast-radius developer tooling: no `src/` files change, the thresholds are baseline-calibrated, and the gate is therefore expected green on introduction.

## Requirements Inventory

### Functional Requirements

Restated verbatim from the PRD (`## Functional Requirements`):

- FR1: The repository can pin `rust-code-analysis-cli` to a single source-of-truth version (`RCA_VERSION = 0.0.25`) declared in the Makefile, and reference it as a host-resolved binary (`RCA_BIN`) rather than an npm devDependency under `$(BIN_DIR)/...`.
- FR2: The toolchain can provision the pinned CLI deterministically and securely — either `cargo install rust-code-analysis-cli --version "$RCA_VERSION" --locked`, or downloading the pinned release tarball `rust-code-analysis-linux-cli-x86_64.tar.gz` and verifying its SHA256 (`9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894`) before execution.
- FR3: The thresholds can be defined in a committed, in-repo policy file that is the single source of truth applied identically by the local `make lint-metrics` target and the CI gate.
- FR4: The committed policy can be validated against a committed JSON Schema (well-formedness, known keys, numeric bounds) before enforcement, so a malformed policy fails fast rather than silently mis-gating.
- FR5: The policy can classify every metric as either a **hard** threshold (blocking — breach fails the build) or a **review** threshold (non-blocking — computed and reported but never failing CI), and the gate can fail only on hard-threshold breaches.
- FR5a: The policy can enforce a hard maximum on **cyclomatic complexity** per function/closure.
- FR5b: The policy can enforce a hard maximum on **cognitive complexity** per function/closure.
- FR5c: The policy can enforce a hard **Maintainability Index** floor (`mi_visual_studio`) per file — reading `metrics.mi` with a legacy `metrics.maintanability_index` fallback — while tracking `mi_original` and `mi_sei` as review thresholds.
- FR5d: The policy can enforce hard maxima on **Halstead volume** and **Halstead bugs** at function and file scope, with the remaining Halstead submetrics (operators/operands, length, vocabulary, difficulty, level, effort, time, purity ratio) tracked as review thresholds.
- FR5e: The policy can enforce hard maxima on **size/LOC** metrics — logical (`lloc`), physical (`ploc`), and source (`sloc`) lines — at both function and file scope.
- FR5f: The policy can enforce hard maxima on **structural** metrics per function/closure — ABC magnitude, NARGS (distinct function-argument and closure-argument maxima), and NEXITS (exit-point count).
- FR5g: The policy can enforce hard maxima on **Number of Methods** (NOM) per file — functions, closures, and their total.
- FR5h: The policy can bound **class and interface** metrics (`wmc`, `npm`, `npa`, `coa`, `cda`; interface `npm`/`npa`) as hard thresholds for forward-compatibility, acknowledging that these are largely inert for TypeScript in v0.0.25 and must be confirmed during the baseline run rather than relied upon.
- FR5i: The policy can track **comment-ratio** and **blank-ratio** band checks (min..max) as review (non-blocking) thresholds, using range logic distinct from the simple `value > max` checks.
- FR6: The analyzer can target the `src/` TypeScript source tree restricted to `*.ts` and `*.tsx` files, skipping `*.js`/`*.jsx` (the sole production `.js` being an already-excluded config file).
- FR7: The governed scope can exclude non-production and unsupported assets — `src/test`, `*.d.ts`, `assets`, `config`, `node_modules`, build outputs (`out/`, `.next/`), and `specs/**` — consistent with the existing `.qlty/qlty.toml` exclusion precedent.
- FR8: The gate can evaluate the full governed scope on every run, with no changed-files-only / incremental mode, so coverage is uniform across pull requests.
- FR9: A `make lint-metrics` target can run the analyzer on the **host** (never via `PNPM_EXEC` / the dev container), emit metrics as JSON, and pass them through a `scripts/ci/` enforcement wrapper that parses the metrics against the committed policy and exits non-zero past any hard threshold — because `rust-code-analysis-cli` itself only emits metrics and never self-fails. **This host-only, parse-and-enforce design is a deliberate deviation from the npm-tool gate pattern and must be documented.**
- FR10: The `lint-metrics` target can be kept **out** of both the `lint` aggregate (`lint: lint-next lint-tsc lint-md lint-deps`) and `CI_LINT_TARGETS`, and can ship **no** DinD wrapper, because the host-only Rust binary is absent from the dev container; its only CI surface is the dedicated workflow, and `make help` can list it via its trailing `## ` description. **This omission is deliberate and must be documented like the Makefile's existing "intentionally not ported" notes.**
- FR11: The enforcement wrapper can report **all** hard violations before exiting (collect-all-then-fail), never fail-fast, so a contributor can remediate every breach in a single pass.
- FR12: From a failed run, a developer can identify the offending **file**, **function/scope** (with start line), **metric**, **measured value**, and **breached threshold** directly from the output, without consulting the raw analyzer JSON.
- FR13: A dedicated `.github/workflows/rust-code-analysis.yml` workflow can run the metrics gate automatically on every `pull_request` targeting `branches: [main]`, with the job named `rust-code-analysis`.
- FR14: The CI workflow can install the pinned `rust-code-analysis-cli` (matching `RCA_VERSION`) before running the gate, omitting the Node/pnpm/`make install` steps that other workflows use, since the analyzer reads the source tree directly.
- FR15: The CI workflow can fail the pull request (non-zero exit / failed required check) whenever any **hard**-threshold violation is detected, while review-tier breaches surface without failing the build.
- FR16: The CI workflow can declare least-privilege `permissions: contents: read`, set `env: CI: 1`, and check out the repository with a SHA-pinned action and `persist-credentials: false`.
- FR17: A passing run can report the measured metric values / summary in the CI job output, so successful runs are informative and not merely silent.
- FR18: The README can include a "Code Metrics (rust-code-analysis)" section — modeled on the existing "Architecture Rules (dependency-cruiser)" section — that lists what is enforced, the hard and review threshold sets, and links the dedicated workflow.
- FR19: The CONTRIBUTING guide can include a "Code metrics (rust-code-analysis)" subsection describing when the gate runs and where budgets live, and the new target can be recorded in `tests/bats/make-target-coverage.tsv` so Makefile shell coverage stays complete.
- FR20: The documentation can describe `make lint-metrics` as the single local command (including host-binary install) and explain how to interpret failure output and passing summaries without raw-tool interpretation.
- FR21: The documentation can explain how to **raise a budget / grant an exception** by adjusting the committed policy (a reviewed, in-repo change) or confirming a path belongs outside the governed scope, rather than silently disabling the gate.

### Non-Functional Requirements

Restated verbatim from the PRD (`## Non-Functional Requirements`):

- NFR1: A full metrics analysis of the governed `src/` scope must complete within the existing static-testing time budget — comparable to the other static linters — requiring no application build, no `node_modules`, and no running services.
- NFR2: The analysis must operate on the source tree only (no compilation, no dev container, no service startup), keeping the CI job lightweight and host-runnable.
- NFR3: The check must be deterministic: the same commit, policy, and pinned CLI version produce the same pass/fail result on every run, with no flakiness.
- NFR4: Metric computation must be reproducible across local and CI environments given identical source, committed policy, and pinned `RCA_VERSION`.
- NFR5: Any **hard**-threshold violation must cause a non-zero exit code and a failed CI check; **review**-threshold breaches must surface (or be tracked) without failing the build.
- NFR6: Violation output must be actionable — naming the file, function/scope, metric, measured value, and breached threshold — so failures are self-explanatory in the CI log without raw-tool interpretation.
- NFR7: The host binary must be provisioned reproducibly and securely — a pinned `RCA_VERSION` plus a SHA256-verified release tarball or a `--locked` `cargo install` — so an unexpected, mismatched, or tampered artifact cannot enter the build, and analysis must require no network access at evaluation time.
- NFR8: The CI workflow must run with least privilege (`permissions: contents: read`), a SHA-pinned checkout action, and `persist-credentials: false`.
- NFR9: The thresholds and the governed-scope definition must live in committed, in-repo configuration that is the single source of truth applied identically by the local target and CI; any README mirror of the thresholds must be flagged as "must be kept in sync" with the policy file.
- NFR10: The gate must follow the website's existing conventions (Makefile variable-block style, `## ` help comments, the dependency-cruiser workflow skeleton) while explicitly documenting its deliberate divergences — host-only execution, exclusion from the `lint` aggregate and `CI_LINT_TARGETS`, no DinD wrapper, and a parse-and-enforce wrapper instead of a self-failing CLI.
- NFR11: Thresholds must be baseline-calibrated to the website's current `src/` distribution so the gate reports **zero hard violations** on introduction (green on day one), and the inert-for-TS class/interface metrics must be confirmed during the baseline run rather than assumed.
- NFR12: A contributor must be able to run the identical gate locally with one command (`make lint-metrics`) before pushing, on a host with the pinned CLI provisioned, and obtain the same hard/review result the CI gate would produce.

### Additional Requirements (architecture-derived)

These derive from the architecture decisions (`architecture-rust-code-analysis-2026-06-25.md`) and constrain implementation beyond the raw FR/NFR text:

- AR1 (AD-1): The binary is provisioned by a single helper `scripts/ci/ensure-rca.sh` shared by local and CI — on Linux x86_64 it downloads the pinned asset `rust-code-analysis-linux-cli-x86_64.tar.gz` from `https://github.com/mozilla/rust-code-analysis/releases/download/v$(RCA_VERSION)/...`, verifies SHA256 `9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894` via `sha256sum -c`, and installs to gitignored `./bin/rust-code-analysis-cli`; for non-amd64 hosts / macOS (no v0.0.25 prebuilt asset) it falls back to `cargo install rust-code-analysis-cli --version 0.0.25 --locked`. The helper is idempotent (a binary already at the pinned version is a no-op).
- AR2 (AD-2): The policy is two top-level objects `hard` and `review` (numeric values only), ported verbatim from CRM as a baseline placeholder; the schema is draft-07 with `required: ["hard"]`, `additionalProperties: false`, and per-key `minimum`/`maximum` bounds, validated by an in-script jq validator **before** enforcement (unknown/missing keys, non-numeric, bound breaches → exit 1).
- AR3 (AD-2): The Maintainability-Index read uses the load-bearing fallback `(.metrics.mi // .metrics.maintanability_index)`; null-safe `gt`/`lt`/`range` comparisons mean absent (TS-inert) class/interface metrics never fire; class/interface thresholds are kept hard-but-permissive for forward-compat and must be confirmed inert at the baseline run.
- AR4 (AD-3): The CLI is invoked as `"$RCA_BIN" -m -O json -p src` with includes `-I '*.ts' -I '*.tsx'` and excludes `-X '*/test/*' '*.d.ts' '*/assets/*' '*/config/*'` built in a `set -f` loop; scope/includes/excludes live in the Makefile var block as the single source of truth; full scope is analyzed every run.
- AR5 (AD-4): The wrapper is POSIX `sh` + `jq` (`set -eu`) at `scripts/ci/lint-metrics.sh`; it emits pipe-delimited `severity|file|scope|subject|line|metric|value|limit` rows with `FAIL` for hard and `REVIEW` for review, counts only `FAIL` rows toward the exit code, mirrors the summary/violation table into `$GITHUB_STEP_SUMMARY` behind a null-guard when set, and runs on the host (never CRM's `docker compose run rca`).
- AR6 (AD-5): The Makefile gains an `RCA_*` var block in the aligned `*_BIN` style with a clarifying comment that `RCA_BIN` is intentionally NOT a `$(BIN_DIR)/...` entry; the target runs `scripts/ci/ensure-rca.sh` then `sh scripts/ci/lint-metrics.sh` directly (never `$(PNPM_EXEC)`); the `lint` aggregate (line 292) and `CI_LINT_TARGETS` (line 108) are left UNCHANGED; no `run-*-dind` wrapper is added; a Makefile note mirroring the existing lines 353-373 records the deliberate divergences.
- AR7 (AD-6): The dedicated workflow has display name `rust code analysis`, job key/required-check `rust-code-analysis`, top-level `permissions: {}` + job `permissions: contents: read`, `env: CI: 1`, `concurrency: { group: rca-${{ github.ref }}, cancel-in-progress: true }`, `timeout-minutes: 10`, a SHA-pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2` with `persist-credentials: false`, provisions the CLI via `ensure-rca.sh`, and OMITS the Node/pnpm/cache/`make install` steps.
- AR8 (AD-7): The README threshold mirror is flagged "must be kept in sync with `config/metrics-policy.json`"; a budget change is a reviewed edit to the committed policy visible in the PR diff — never a silent local override or a per-line disable.
- AR9 (Constraint): This is a planning-artifacts-only program of work for the spec phase; the **implementation stories below describe the changes a future PR will apply** to `.gitignore`, the `Makefile`, `config/`, `scripts/ci/`, the workflow, the README, CONTRIBUTING, and `tests/bats/`. No story touches `src/`.
- AR10 (Constraint, NFR11): The embedded `hard` threshold values are CRM-derived placeholders that must be **re-baselined** against the website `src/` distribution (and the class/interface metrics confirmed inert for TS in v0.0.25) before `rust-code-analysis` is registered as a required status check.

### UX Design Requirements

None apply. This is developer tooling / CI infrastructure: there is no end-user interface, no visual design, no front-end component, and no UX flow in scope. The only "interface" is the human-readable CLI/CI violation output covered by FR12/NFR6.

### FR Coverage Map

Every FR from the PRD is covered by at least one story below.

| FR | Subject | Epic | Story |
| --- | --- | --- | --- |
| FR1 | pin `RCA_VERSION`; host-resolved `RCA_BIN` | Epic 1 | 1.1 |
| FR2 | deterministic, SHA256-verified provisioning | Epic 1 | 1.1 |
| FR3 | committed single-source-of-truth policy file | Epic 2 | 2.1 |
| FR4 | JSON Schema validation of the policy | Epic 2 | 2.1 |
| FR5 | hard vs review two-tier classification | Epic 2 | 2.1 |
| FR5a | cyclomatic complexity hard max | Epic 2 | 2.2 |
| FR5b | cognitive complexity hard max | Epic 2 | 2.2 |
| FR5c | MI floor (`mi_visual_studio`) + legacy fallback | Epic 2 | 2.2 |
| FR5d | Halstead volume/bugs hard; submetrics review | Epic 2 | 2.2 |
| FR5e | size/LOC (`lloc`/`ploc`/`sloc`) function & file | Epic 2 | 2.2 |
| FR5f | ABC, NARGS, NEXITS structural hard maxima | Epic 2 | 2.2 |
| FR5g | NOM functions/closures/total per file | Epic 2 | 2.2 |
| FR5h | class/interface bounds (forward-compat) | Epic 2 | 2.2 |
| FR5i | comment/blank ratio band checks (review) | Epic 2 | 2.2 |
| FR6 | `src/` `*.ts`/`*.tsx` only; skip `*.js`/`*.jsx` | Epic 3 | 3.1 |
| FR7 | exclusions per `.qlty` precedent | Epic 3 | 3.1 |
| FR8 | full-scope evaluation each run | Epic 3 | 3.1 |
| FR9 | host-only `make lint-metrics` + enforce wrapper | Epic 4 | 4.1 |
| FR10 | out of `lint` aggregate/`CI_LINT_TARGETS`; no DinD | Epic 4 | 4.1 |
| FR11 | collect-all-then-fail | Epic 4 | 4.2 |
| FR12 | actionable file/function/metric/value/threshold | Epic 4 | 4.2 |
| FR13 | dedicated workflow auto-runs on PR->main | Epic 5 | 5.1 |
| FR14 | install pinned CLI in CI (no Node/pnpm) | Epic 5 | 5.1 |
| FR15 | fail on hard violations | Epic 5 | 5.1 |
| FR16 | hardened permissions + pinned checkout + CI:1 | Epic 5 | 5.2 |
| FR17 | passing-run metric summary | Epic 5 | 5.2 |
| FR18 | README metrics section | Epic 6 | 6.1 |
| FR19 | CONTRIBUTING subsection + bats coverage tsv | Epic 6 | 6.2 |
| FR20 | local usage + failure/summary interpretation | Epic 6 | 6.1 |
| FR21 | how to raise a budget / grant an exception | Epic 6 | 6.2 |

## Epic List

### Epic 1: Tooling & Binary Provisioning

Establishes the substrate everything else runs on: pinning `rust-code-analysis-cli` to a single source-of-truth `RCA_VERSION = 0.0.25`, declaring the host-resolved `RCA_BIN = ./bin/rust-code-analysis-cli` (with a clarifying comment that it is intentionally NOT a `$(BIN_DIR)/...` npm entry), and authoring the `scripts/ci/ensure-rca.sh` provisioning helper that downloads the pinned SHA256-verified Linux release tarball — or falls back to `cargo install --locked` on non-amd64/macOS — and installs it to gitignored `./bin/`. Because the analyzer is a standalone Rust binary absent from the `node:23.x-alpine` dev image, no other gate can run until this provisioning path exists; this epic is the prerequisite for Epics 4 and 5.

**FRs covered:** FR1, FR2

### Epic 2: Metrics Policy & Thresholds

Authors the definition of "too complex": the committed `config/metrics-policy.json` (the single source of truth applied identically by local and CI), its draft-07 `config/metrics-policy.schema.json` validated before enforcement, the two-tier hard/review classification (fail only on hard), and the full metric surface — cyclomatic, cognitive, Halstead volume/bugs, size/LOC, ABC, NARGS, NEXITS, NOM, and the Maintainability-Index floor as hard thresholds; the remaining Halstead submetrics, secondary MI variants, and comment/blank-ratio band checks as review thresholds; and the class/interface bounds kept hard-but-permissive for forward-compatibility. The policy is ported verbatim from CRM as a baseline placeholder flagged for re-baselining in Epic 5.

**FRs covered:** FR3, FR4, FR5, FR5a, FR5b, FR5c, FR5d, FR5e, FR5f, FR5g, FR5h, FR5i

### Epic 3: Analysis Scope

Pins what is measured: the Makefile `RCA_SCOPE`/`RCA_INCLUDES`/`RCA_EXCLUDES` var block restricting analysis to `src/` `*.ts`/`*.tsx`, skipping `*.js`/`*.jsx`, and excluding `src/test`, `*.d.ts`, `assets`, and `config` — aligned to the existing `.qlty/qlty.toml` exclusion precedent — with the full governed scope evaluated on every run (no changed-files mode). Scope lives in one place so local and CI measure identically.

**FRs covered:** FR6, FR7, FR8

### Epic 4: Local Developer Workflow

Makes the gate locally runnable and turns emitted metrics into a verdict. Adds the host-only `make lint-metrics` target (runs `ensure-rca.sh` then the wrapper directly, never through `PNPM_EXEC`), kept deliberately **out** of the `lint` aggregate and `CI_LINT_TARGETS` with **no** DinD wrapper and a documented divergence note, and authors the `scripts/ci/lint-metrics.sh` parse-and-enforce wrapper that validates the policy against the schema, runs the analyzer, and — because `rust-code-analysis-cli` only emits metrics and never self-fails — owns the exit-code contract: collect-all-then-fail with actionable file/function/metric/value/threshold output and the two-tier `FAIL`/`REVIEW` model.

**FRs covered:** FR9, FR10, FR11, FR12

### Epic 5: CI Enforcement

Turns the gate into an authoritative, automatic, hardened required check. Adds the dedicated `.github/workflows/rust-code-analysis.yml` on `pull_request -> branches:[main]` (job `rust-code-analysis`) that installs the pinned CLI and runs `make lint-metrics CI=1`, omitting the Node/pnpm/`make install` steps; hardens it with `permissions: {}` top-level + `contents: read` job, `env: CI: 1`, a SHA-pinned checkout with `persist-credentials: false`, concurrency, and a 10-minute timeout, and reports the measured-metric summary on a passing run; then verifies baseline compliance (re-baselining the placeholder thresholds and confirming inert class/interface metrics) and registers `rust-code-analysis` as a required status check for `main`.

**FRs covered:** FR13, FR14, FR15, FR16, FR17

### Epic 6: Documentation

Converts the gate from a surprising roadblock (missing from `make lint`) into a self-service tool. Adds the README "Code Metrics (rust-code-analysis)" section listing what is enforced and the hard/review threshold sets, documents `make lint-metrics` as the single local command and how to read failures and passing summaries, flags the README mirror "keep in sync" with the policy, adds the CONTRIBUTING "Code metrics (rust-code-analysis)" subsection and the budget-exception protocol, and records the new target in `tests/bats/make-target-coverage.tsv` with a bats test so Makefile shell coverage stays complete.

**FRs covered:** FR18, FR19, FR20, FR21

## Epic 1 Stories: Tooling & Binary Provisioning

### Story 1.1: Pin and provision the rust-code-analysis CLI as a verified host binary

As a security-conscious CI maintainer,
I want `rust-code-analysis-cli` pinned to `RCA_VERSION = 0.0.25` and provisioned as a SHA256-verified host binary at `./bin/rust-code-analysis-cli`,
So that the gate has a deterministic, tamper-resistant analyzer available identically on a contributor's host and on the CI runner without an npm dependency or a Rust container.

**Prerequisites:** None — first story in the sequence.

**Files touched:** `Makefile` (`RCA_*` var block), `scripts/ci/ensure-rca.sh` (new), `.gitignore`.

**Acceptance Criteria:**

- **Given** the Makefile, **When** the variable block is added, **Then** `RCA_VERSION = 0.0.25` and `RCA_BIN = ./bin/rust-code-analysis-cli` (plus `RCA_SHA256_LINUX`) are declared in the aligned `*_BIN` var block with a clarifying comment that `RCA_BIN` is intentionally NOT a `$(BIN_DIR)/...` entry (FR1, AR6, NFR10).
- **Given** `scripts/ci/ensure-rca.sh`, **When** it is authored, **Then** on Linux x86_64 it downloads the pinned asset `rust-code-analysis-linux-cli-x86_64.tar.gz` from `https://github.com/mozilla/rust-code-analysis/releases/download/v0.0.25/...`, verifies SHA256 `9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894` via `sha256sum -c`, installs to `./bin/rust-code-analysis-cli`, and runs `--version` (FR2, AR1, NFR7).
- **And** for non-amd64 hosts and macOS (no v0.0.25 prebuilt asset), the helper falls back to `cargo install rust-code-analysis-cli --version 0.0.25 --locked` (FR2, AR1).
- **Given** a binary already present at the pinned version, **When** `ensure-rca.sh` runs, **Then** it is idempotent and exits `0` without re-downloading, and requires no network access when already provisioned (FR2, NFR4, NFR7).
- **Given** `.gitignore`, **When** it is updated, **Then** `/bin/` is ignored so the provisioned binary is never committed (FR1, AR1).
- **And** no file under `src/` is touched by this change (AR9).

## Epic 2 Stories: Metrics Policy & Thresholds

### Story 2.1: Commit the metrics policy, JSON Schema, and the two-tier hard/review mechanism

As a CI maintainer,
I want a committed `config/metrics-policy.json` validated against a committed JSON Schema and split into blocking `hard` and non-blocking `review` tiers,
So that "too complex" is defined once, in-repo, machine-checkable, and applied identically by the local target and CI.

**Prerequisites:** None — independent of Epic 1 (no binary required to author the policy).

**Files touched:** `config/metrics-policy.json` (new), `config/metrics-policy.schema.json` (new).

**Acceptance Criteria:**

- **Given** `config/`, **When** the policy is added, **Then** `config/metrics-policy.json` is committed with exactly two top-level objects `hard` and `review` (numeric values only), as the single source of truth applied identically by `make lint-metrics` and the CI gate (FR3, AR2, NFR9).
- **Given** `config/`, **When** the schema is added, **Then** `config/metrics-policy.schema.json` is draft-07 with `$schema`/`$id`, `required: ["hard"]`, `additionalProperties: false`, and per-key `minimum`/`maximum` bounds (FR4, AR2).
- **Given** the two-tier model, **When** the policy is classified, **Then** every metric belongs to either `hard` (a breach fails the build) or `review` (computed and reported but never failing), and only `hard` breaches can fail the gate (FR5, NFR5).
- **And** the policy ports the CRM values verbatim as a baseline placeholder flagged for re-baselining against the website `src/` before the check is made required (AR2, AR10, NFR11).
- **And** no file under `src/` is touched by this change (AR9).

### Story 2.2: Populate the full hard and review threshold metric sets

As a CI maintainer,
I want the policy populated with the complete metric surface — cyclomatic, cognitive, Halstead, size/LOC, ABC, NARGS, NEXITS, NOM, MI, class/interface, and ratio band checks — split across the hard and review tiers,
So that every meaningful TypeScript complexity dimension is bounded and the schema's required-key list matches the populated policy exactly.

**Prerequisites:** Story 2.1 (the policy file, schema, and two-tier mechanism must exist).

**Files touched:** `config/metrics-policy.json`, `config/metrics-policy.schema.json`.

**Acceptance Criteria:**

- **Given** the `hard` block, **When** per-function thresholds are populated, **Then** `cyclomatic_max`, `cognitive_max`, `abc_magnitude_max`, `nargs_function_max`/`nargs_closure_max`, `nexits_max`, and per-function size `lloc_function_max`/`ploc_function_max`/`sloc_function_max` are present (FR5a, FR5b, FR5e, FR5f).
- **Given** the `hard` block, **When** Halstead thresholds are populated, **Then** `halstead_volume_function_max`/`halstead_bugs_function_max` and `halstead_volume_file_max`/`halstead_bugs_file_max` are hard, while the remaining Halstead submetrics (operators/operands, length, vocabulary, difficulty, level, effort, time, purity ratio) are placed in `review` (FR5d, FR5i).
- **Given** the `hard` block, **When** file-scope thresholds are populated, **Then** NOM `nom_functions_file_max`/`nom_closures_file_max`/`nom_total_file_max`, file size `lloc_file_max`/`ploc_file_max`/`sloc_file_max`, and the MI floor `mi_visual_studio_min` are present — the wrapper reading `(.metrics.mi // .metrics.maintanability_index)` — with `mi_original`/`mi_sei` placed in `review` (FR5c, FR5g, AR3).
- **Given** forward-compatibility, **When** class/interface thresholds are populated, **Then** `class_wmc_max`/`class_npm_max`/`class_npa_max`/`class_coa_max`/`class_cda_max` and `interface_npm_max`/`interface_npa_max` are bounded hard-but-permissive, acknowledged inert for TS in v0.0.25, and safe via null-safe comparisons so absent values never fire (FR5h, AR3, NFR11).
- **Given** the `review` block, **When** ratio band checks are populated, **Then** `cloc_ratio_min`/`cloc_ratio_max` and `blank_ratio_min`/`blank_ratio_max` use min..max range logic distinct from the `value > max` checks and never block (FR5i).
- **And** the schema's `required` list and per-key bounds match the populated `hard` keys exactly so a malformed policy fails fast (FR4, AR2).

## Epic 3 Stories: Analysis Scope

### Story 3.1: Define the governed analysis scope and exclusion globs

As a CI maintainer,
I want the analyzer restricted to `src/` `*.ts`/`*.tsx` with `src/test`, `*.d.ts`, `assets`, and `config` excluded, defined once in the Makefile,
So that the gate measures only production TypeScript and never inflates metrics with test, type-declaration, or generated/config noise.

**Prerequisites:** Story 1.1 (shares the Makefile `RCA_*` var block).

**Files touched:** `Makefile` (`RCA_SCOPE`/`RCA_INCLUDES`/`RCA_EXCLUDES`).

**Acceptance Criteria:**

- **Given** the Makefile var block, **When** the scope vars are added, **Then** `RCA_SCOPE = src`, `RCA_INCLUDES` selects `*.ts` and `*.tsx` (`-I '*.ts' -I '*.tsx'`), and `RCA_EXCLUDES` lists `*/test/*`, `*.d.ts`, `*/assets/*`, `*/config/*` (`-X` per pattern) (FR6, FR7, AR4).
- **Given** the include filter, **When** the analyzer runs, **Then** `*.js`/`*.jsx` are skipped — the sole production `.js` (`src/config/i18nConfig.js`) is doubly excluded by both the `*.js` skip and `*/config/*` (FR6).
- **Given** other roots and build outputs, **When** scope is set, **Then** `node_modules`, build outputs (`out/`, `.next/`), and `specs/**` are naturally outside `-p src` and are not re-scanned (FR7).
- **Given** uniform coverage, **When** the gate runs, **Then** the full governed scope is evaluated on every run with no changed-files-only / incremental mode (FR8).
- **And** scope and exclusions live in the Makefile var block as the single source of truth shared with CI (NFR9, AR4, AR6).

## Epic 4 Stories: Local Developer Workflow

### Story 4.1: Add the host-only make lint-metrics target and the parse-and-enforce wrapper

As a developer,
I want a single `make lint-metrics` command that provisions the binary, runs the analyzer on the host, and pipes its metrics through an enforcement wrapper,
So that I can validate complexity locally before opening a PR without a Rust container and without touching the dev-container `PNPM_EXEC` path.

**Prerequisites:** Story 1.1 (binary provisioning), Story 2.1/2.2 (policy + schema), Story 3.1 (scope vars).

**Files touched:** `Makefile` (`lint-metrics` target + divergence note), `scripts/ci/lint-metrics.sh` (new).

**Acceptance Criteria:**

- **Given** the Makefile, **When** the target is added, **Then** `lint-metrics` runs `scripts/ci/ensure-rca.sh` then `sh scripts/ci/lint-metrics.sh` with the `RCA_*`/`METRICS_POLICY` env, carries a trailing `## ` description, and does NOT use `$(PNPM_EXEC)` — running host-only in both local and CI modes (FR9, AR6, NFR2).
- **Given** the wrapper, **When** `scripts/ci/lint-metrics.sh` is authored, **Then** it requires `jq`, validates that the policy exists and is valid JSON, validates it against the schema via an in-script jq validator, and runs `"$RCA_BIN" -m -O json -p "$RCA_SCOPE"` with the `-I` include and `-X` exclude loop (`set -f`), parsing the emitted NDJSON against the policy — because `rust-code-analysis-cli` only emits metrics and never self-fails (FR9, AR4, AR5).
- **Given** the aggregate and parallel runner, **When** the target is wired, **Then** `lint-metrics` is kept OUT of the `lint` aggregate (line 292 unchanged) and `CI_LINT_TARGETS` (line 108 unchanged), ships NO `run-*-dind` wrapper, and a Makefile note (mirroring the existing lines 353-373) records why these omissions are deliberate (FR10, AR6, NFR10).
- **And** `make help` lists `lint-metrics` via its trailing `## ` description (FR10).
- **And** against current `main` with the binary provisioned, `make lint-metrics` runs host-only without any dev-container / `PNPM_EXEC` path (FR9, NFR2, NFR12).

### Story 4.2: Implement collect-all-then-fail enforcement and actionable output

As a developer,
I want the wrapper to report every hard violation in one pass with the exact file, function/scope, metric, value, and threshold, while review breaches are tracked but never block,
So that I can remediate all complexity breaches in a single iteration without interpreting raw analyzer JSON.

**Prerequisites:** Story 4.1 (the wrapper + target exist), Story 2.2 (the full threshold sets exist).

**Files touched:** `scripts/ci/lint-metrics.sh`.

**Acceptance Criteria:**

- **Given** the findings pass, **When** the wrapper walks each file's function/closure spaces and the file aggregate with a `jq -rs` program, **Then** it emits pipe-delimited `severity|file|scope|subject|line|metric|value|limit` rows with `FAIL` for hard metrics and `REVIEW` for review metrics (FR11, FR12, AR5).
- **Given** hard violations, **When** the gate runs, **Then** it reports ALL hard violations before exiting (collect-all-then-fail, never fail-fast) and exits `1` only after the full report (FR11, NFR5).
- **Given** a failed run, **When** output is rendered, **Then** an aligned table (`GATE FILE SCOPE SUBJECT LINE METRIC VALUE LIMIT`) names the file, the function/scope with its start line, the metric, the measured value, and the breached threshold — actionable without reading raw JSON (FR12, NFR6).
- **Given** the two-tier contract, **When** review thresholds are breached, **Then** `REVIEW` rows are computed but never counted toward the exit code and never fail the build (FR11, NFR5).
- **And** when `$GITHUB_STEP_SUMMARY` is set the wrapper mirrors the summary/violation table there behind a null-guard, and when unset it completes without error (FR12, AR5).
- **And** the MI read uses `(.metrics.mi // .metrics.maintanability_index)` and null-safe `gt`/`lt`/`range` helpers so absent (TS-inert) metrics never fire (AR3).

## Epic 5 Stories: CI Enforcement

### Story 5.1: Add the dedicated rust-code-analysis CI workflow

As a CI maintainer,
I want a dedicated workflow that runs the metrics gate automatically on every PR to `main`, installs the pinned CLI, and fails on any hard violation,
So that complexity breaches are blocked at PR time as their own isolated required check, without the Node/pnpm setup the analyzer does not need.

**Prerequisites:** Story 1.1 (provisioning helper), Story 4.1/4.2 (target + wrapper).

**Files touched:** `.github/workflows/rust-code-analysis.yml` (new).

**Acceptance Criteria:**

- **Given** `.github/workflows/`, **When** the workflow is added, **Then** `rust-code-analysis.yml` triggers on `pull_request` with `branches: [main]`, has display name `rust code analysis`, and job key `rust-code-analysis` (FR13, AR7).
- **Given** the job, **When** it runs, **Then** it installs the pinned CLI via `scripts/ci/ensure-rca.sh` (matching `RCA_VERSION`) and OMITS the Node/pnpm/cache/`make install` steps the other workflows carry, since the analyzer reads the source tree directly (FR14, AR7).
- **Given** a PR that breaches any hard threshold, **When** the workflow runs, **Then** `make lint-metrics CI=1` exits non-zero and the required check fails; review-tier breaches surface without failing (FR15, NFR5).
- **And** the job runs `make lint-metrics CI=1` host-only on `ubuntu-latest`, completing well within the static-testing budget with no build and no services (FR13, NFR1, NFR2).

### Story 5.2: Harden the workflow and report passing metric summaries

As a security-conscious CI maintainer,
I want the workflow to run with least-privilege permissions and a SHA-pinned checkout, and a passing run to print the measured metrics,
So that the gate is supply-chain-hardened and successful runs are informative rather than silent.

**Prerequisites:** Story 5.1 (the workflow exists).

**Files touched:** `.github/workflows/rust-code-analysis.yml`.

**Acceptance Criteria:**

- **Given** permissions, **When** declared, **Then** the workflow sets top-level `permissions: {}` and job-level `permissions: contents: read` (least privilege) (FR16, NFR8, AR7).
- **Given** the checkout step, **When** authored, **Then** it uses a SHA-pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2` with `persist-credentials: false`, sets `env: CI: 1`, `concurrency: { group: rca-${{ github.ref }}, cancel-in-progress: true }`, and `timeout-minutes: 10` (FR16, NFR8, AR7).
- **Given** a passing run, **When** the gate completes, **Then** the measured metric values / summary are reported in the CI job output (and mirrored to `$GITHUB_STEP_SUMMARY`), so success is informative (FR17).
- **And** the workflow filename, name, and shape mirror `dependency-cruiser.yml` minus the Node/pnpm block, recorded as a deliberate divergence (NFR10, AR7).

### Story 5.3: Verify baseline compliance and register the required status check

As a CI maintainer,
I want to run the gate against current `main`, re-baseline the placeholder thresholds to zero hard violations, confirm the class/interface metrics are inert, and then register `rust-code-analysis` as a required check,
So that the gate is green on introduction and cannot be merged around once enforcement is enabled.

**Prerequisites:** Story 2.2 (full thresholds), Story 5.1/5.2 (the runnable, hardened workflow).

**Files touched:** `config/metrics-policy.json` (threshold re-baselining), repository branch-protection settings (operational — no committed file).

**Acceptance Criteria:**

- **Given** current `main`, **When** `make lint-metrics` is run, **Then** any hard violations are addressed by re-baselining the CRM-derived placeholder thresholds (or confirming a path belongs outside the governed scope) until the gate exits `0` (NFR11, AR10).
- **Given** the class/interface metrics, **When** the baseline runs, **Then** their emitted values are confirmed (expected inert/absent for TS in v0.0.25) and the thresholds are left bounded-but-permissive accordingly (FR5h, AR3, NFR11).
- **Given** the workflow has run at least once on a PR / `main`, **When** branch protection is configured, **Then** `rust-code-analysis` is registered as a required status check for `main` (FR15).
- **Given** a PR that introduces a hard violation, **When** the check runs, **Then** the PR cannot merge until it passes; a PR within thresholds shows passing and is not blocked (FR15, NFR5).
- **And** the baseline-green result is recorded so the gate is demonstrably green on introduction and reproducible local↔CI (NFR3, NFR4, NFR11, NFR12).

## Epic 6 Stories: Documentation

### Story 6.1: Add the README Code Metrics section and document local usage

As a developer,
I want a README "Code Metrics (rust-code-analysis)" section listing what is enforced and how to run and read the gate locally,
So that I can understand the complexity rules and act on a failure without reading the policy file or the raw analyzer output.

**Prerequisites:** Story 2.2 (the thresholds to mirror), Story 4.1/4.2 (the command and output to document).

**Files touched:** `README.md`.

**Acceptance Criteria:**

- **Given** the README, **When** the section is added, **Then** a "## Code Metrics (rust-code-analysis)" section (modeled on the existing "## Architecture Rules (dependency-cruiser)" section) lists what is enforced, the hard and review threshold sets, and links `.github/workflows/rust-code-analysis.yml` (FR18).
- **Given** the command list, **When** updated, **Then** a `make lint-metrics` line is added under "Linting & Formatting" (FR18, FR20).
- **Given** local usage, **When** documented, **Then** the README describes `make lint-metrics` as the single local command (the host binary auto-installs to `./bin/`) and explains how to read failure output (file / function / metric / value / threshold) and passing summaries without raw-tool interpretation (FR20, NFR6).
- **And** any README threshold mirror is flagged "must be kept in sync with `config/metrics-policy.json`" (AR8, NFR9).
- **And** the README records the deliberate divergences — host-only execution, out of `make lint` / `CI_LINT_TARGETS`, no DinD wrapper, parse-and-enforce — so contributors are not surprised the gate is absent from `make lint` (FR18, NFR10).

### Story 6.2: Document the CONTRIBUTING subsection, exception protocol, and bats shell-coverage

As a developer,
I want a CONTRIBUTING subsection explaining when the gate runs and how to raise a budget through a reviewed policy edit, plus the new target recorded in the Makefile shell-coverage inventory,
So that I can request a scoped, reviewed exception instead of silently overriding the gate, and Makefile shell coverage stays complete.

**Prerequisites:** Story 4.1 (the `lint-metrics` target to record), Story 6.1 (the README section to link).

**Files touched:** `CONTRIBUTING.md`, `tests/bats/make-target-coverage.tsv`, `tests/bats/*.bats`.

**Acceptance Criteria:**

- **Given** CONTRIBUTING, **When** the subsection is added, **Then** a "#### Code metrics (rust-code-analysis)" subsection under "Make Changes" (modeled on the existing "Dockerfile build performance" subsection) describes when the gate runs on PRs, where budgets live, and links the README section (FR19).
- **Given** the exception protocol, **When** documented, **Then** it explains raising a budget via a reviewed, in-repo edit to `config/metrics-policy.json` (or confirming a path belongs outside the governed scope), and warns against silent local overrides or per-line disabling — the preferred resolution being to fix the offending code first (FR21, AR8).
- **Given** Makefile shell coverage, **When** the target is recorded, **Then** `tests/bats/make-target-coverage.tsv` gains a `lint-metrics` row, a `tests/bats/*.bats` test exercises the provisioning + enforcement contract, and `make test-bats` passes (FR19).
- **And** any new Markdown passes `make lint-md` (NFR10).
