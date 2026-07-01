---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
lastStep: 8
status: complete
completedAt: '2026-06-25'
inputDocuments:
  - specs/rust-code-analysis/planning-artifacts/prd-rust-code-analysis-2026-06-25.md
workflowType: architecture
project_name: website
user_name: BMad
date: '2026-06-25'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

This architecture realizes the PRD `prd-rust-code-analysis-2026-06-25.md` for the VilnaCRM **website** repository: introducing Mozilla `rust-code-analysis` as a CI-enforced **code-complexity** quality gate for the `src/` TypeScript tree. It closes the one quality dimension the repo's existing gates (ESLint, `tsc`, markdownlint, dependency-cruiser) do not measure — per-function and per-file complexity (cyclomatic, cognitive, Halstead, Maintainability Index, size/LOC, ABC, NARGS, NEXITS, NOM). The design adapts the CRM sister-repo's proven `lint-metrics` implementation, but two structural facts force deliberate divergences from how every other gate is wired: the analyzer is a **standalone Rust binary** (not an npm package under `node_modules/.bin`), and it **only emits metrics — it never self-fails on a threshold**.

**Functional Requirements:**

- **Tooling & Binary Provisioning:** FR1 (pin `RCA_VERSION = 0.0.25`; host-resolved `RCA_BIN`, not a `$(BIN_DIR)/...` npm dep), FR2 (deterministic/secure provisioning — SHA256-verified release tarball or `cargo install --locked`).
- **Metrics Policy & Thresholds:** FR3 (committed `config/metrics-policy.json` single source of truth), FR4 (validate against committed JSON Schema before enforcing), FR5 (two-tier hard/review classification, fail only on hard), FR5a (cyclomatic), FR5b (cognitive), FR5c (MI floor `mi_visual_studio` + legacy `maintanability_index` fallback; `mi_original`/`mi_sei` review), FR5d (Halstead volume/bugs hard, submetrics review), FR5e (size/LOC `lloc`/`ploc`/`sloc` function & file), FR5f (ABC magnitude, NARGS function/closure, NEXITS), FR5g (NOM functions/closures/total per file), FR5h (class/interface bounds — forward-compat, inert for TS), FR5i (comment/blank ratio band checks — review).
- **Analysis Scope:** FR6 (`src` restricted to `*.ts`/`*.tsx`; skip `*.js`/`*.jsx`), FR7 (exclude `src/test`, `*.d.ts`, `assets`, `config`, `node_modules`, build outputs, `specs/**`), FR8 (full-scope each run — no changed-files mode).
- **Local Developer Workflow:** FR9 (host-only `make lint-metrics` + `scripts/ci/` parse-and-enforce wrapper that exits non-zero past hard thresholds), FR10 (stay OUT of `lint` aggregate and `CI_LINT_TARGETS`, NO DinD wrapper; surfaced via `make help`), FR11 (collect-all-then-fail), FR12 (actionable output: file, function/scope + start line, metric, value, threshold).
- **CI Enforcement:** FR13 (dedicated `rust-code-analysis.yml` on `pull_request -> branches:[main]`, job `rust-code-analysis`), FR14 (install pinned CLI in CI; no Node/pnpm/`make install`), FR15 (fail PR on hard violation; review surfaces without failing), FR16 (`permissions: contents: read`, `env: CI: 1`, SHA-pinned checkout, `persist-credentials: false`), FR17 (passing run reports measured values).
- **Documentation:** FR18 (README "Code Metrics (rust-code-analysis)" section), FR19 (CONTRIBUTING subsection + `tests/bats/make-target-coverage.tsv`), FR20 (single local command + failure/summary interpretation), FR21 (how to raise a budget / grant an exception via the committed policy).

**Non-Functional Requirements:**

- **Performance:** NFR1 (within the static-testing budget; no build, no `node_modules`, no services), NFR2 (source-tree-only; host-runnable).
- **Reliability:** NFR3 (deterministic — same commit + policy + pinned version → same result), NFR4 (reproducible local ↔ CI).
- **Failure Behavior:** NFR5 (hard breach → non-zero exit + failed check; review non-blocking), NFR6 (actionable output, no raw-tool interpretation).
- **Security:** NFR7 (pinned + SHA256-verified or `--locked`; no network at evaluation time), NFR8 (least-privilege workflow, SHA-pinned action, `persist-credentials: false`).
- **Consistency:** NFR9 (committed single source of truth; README mirror flagged "keep in sync"), NFR10 (follow repo conventions while documenting deliberate divergences).
- **Compatibility:** NFR11 (baseline-calibrated for zero hard violations on day one; confirm inert class/interface metrics), NFR12 (identical gate runnable locally via one `make lint-metrics`).

**Scale & Complexity:** Low blast radius, medium complexity. No `src/` files change. The deliverable is a policy file + JSON Schema, a POSIX-sh enforcement wrapper, a binary-provisioning helper, Makefile wiring, one workflow, and docs. Complexity is concentrated in (a) calibrating thresholds to the website's distribution and (b) the parse-and-enforce wrapper — not in code volume. Source tree today: `src/` holds 206 `.ts` + 137 `.tsx` in total, of which the governed analysis scope (after excluding `src/test`, `*.d.ts`, `assets`, and `config`) is ~132 `.ts` + ~76 `.tsx`; the only non-test `.js` is `src/config/i18nConfig.js` (excluded).

### Architectural Principles

1. **Additive, zero-blast-radius governance.** The gate reads the source tree and reports; it changes no application behavior and touches no file under `src/`. A baseline-calibrated policy means a green gate on day one (NFR11).
2. **Adapt, do not transcribe, the CRM implementation.** CRM is already TypeScript-native, so its `metrics-policy.json`, `metrics-policy.schema.json`, and `lint-metrics.sh` port near-1:1. The genuine adaptation surface is **repo conventions** (host-only execution, scope globs, doc location), not language.
3. **Host-only because the tool is a Rust binary.** Unlike `eslint`/`tsc`/`depcruise` (npm packages reachable through `PNPM_EXEC` inside the `node:23.x-alpine` dev container), `rust-code-analysis-cli` is absent from that image. The gate therefore runs on the **host** in both local and CI modes, and is provisioned from a pinned, verified artifact rather than `make install` (FR1, FR2, NFR2).
4. **A wrapper makes it a gate.** `rust-code-analysis-cli` only emits metrics; it never exits non-zero on a threshold. A thin POSIX-sh wrapper parses the emitted NDJSON against the committed policy and owns the exit-code contract (FR9, NFR5). This is the one place the gate cannot be a 1:1 copy of `lint-deps`.
5. **Two tiers, fail only on hard.** Every metric is classified `hard` (blocking) or `review` (computed, reported, never failing). Review metrics calibrate future tightening without day-one noise (FR5, NFR5).
6. **Single committed source of truth.** Thresholds and scope live in `config/metrics-policy.json` (+ schema), applied identically by local and CI; any README mirror is flagged "keep in sync" (FR3, NFR9). Task-running stays in the Makefile — `package.json` gains no `scripts`.

### Technical Constraints & Dependencies

- **Stack (observed):** Next.js (pages-router, `output:'export'`), React 18.3, TypeScript (`moduleResolution:'bundler'`), MUI v7 + Emotion, Apollo/GraphQL, i18next, Zustand. Feature-based `src/` layout.
- **Source layout (observed):** `src/` top-level dirs are `assets components config features hooks lib providers routes shared stores test types utils` plus `react-app-env.d.ts`. Features live in `src/features/<feature>/`; tests live in `src/test/**`; the lone non-test `.js` is `src/config/i18nConfig.js`.
- **Makefile (observed):** `BIN_DIR = ./node_modules/.bin`; per-tool `*_BIN` vars (lines 16-26); `CI ?= 0` normalized so `1/true/TRUE → 1` (lines 117-122); when `CI=1`, `PNPM_EXEC = pnpm` else `PNPM_EXEC = $(EXEC_DEV_TTYLESS)` (`docker compose exec -T dev`, lines 124-146); `.DEFAULT_GOAL = help`; `make help` greps `^[a-zA-Z0-9_-]+:.*?## ` (lines 161-164); aggregate `lint: lint-next lint-tsc lint-md lint-deps` (line 292); `CI_LINT_TARGETS = lint-next lint-tsc lint-md` (line 108) fanned out by `scripts/ci/run-parallel.sh` (line 110); existing "intentionally NOT ported" note for CRM `lint-metrics` (lines 353-373).
- **Dev/prod images (observed):** `Dockerfile` base `node:23.11.1-alpine3.21`, installs `pnpm@10.6.5 serve@14.2.0` — **no Rust toolchain, no `rust-code-analysis`**. Confirms the gate cannot run through `PNPM_EXEC` / the dev container (FR9, FR10).
- **CI (observed):** `dependency-cruiser.yml` is the closest analog (PR→main, `permissions: contents: read`, `env: CI: 1`, SHA-pinned checkout `persist-credentials: false`, `node-version-file: '.nvmrc'`, pnpm cache, `make install`, `make lint-deps CI=1`). `.nvmrc = 22.12.0`; `package.json` `packageManager: pnpm@10.6.5`, `engines.node >=20.0.0`.
- **Exclusion precedent (observed):** `.qlty/qlty.toml` `exclude_patterns` already exempts `**/*.d.ts`, `**/assets/**`, `**/config/**`, `**/dist/**`, `**/*.min.*`, `specs/**` — the canonical scope precedent reused by FR7.
- **External tool dependency:** Mozilla `rust-code-analysis-cli` **v0.0.25** consumed as an external CLI; `jq` (already present in CI runners and the dev image) drives policy parsing and enforcement. No Rust subproject is introduced.

### Cross-Cutting Concerns Identified

- **No npm install path.** The binary is not an npm dependency, so `make install` / `PNPM_EXEC` cannot provision or run it. Mitigated by a pinned, SHA256-verified host install to gitignored `./bin/` shared by local and CI (AD-1, FR1, FR2, NFR4, NFR7).
- **CLI emits, does not enforce.** Mitigated by the `scripts/ci/lint-metrics.sh` parse-and-enforce wrapper owning pass/fail and exit codes (AD-4, FR9, NFR5).
- **Scope correctness.** TS/TSX only; `src/test`, `*.d.ts`, `assets`, `config` must be out of scope or the gate measures test/generated noise. Mitigated by `-I`/`-X` glob filtering aligned to `.qlty/qlty.toml` (AD-3, FR6, FR7).
- **Day-one noise.** Aspirational thresholds would fail `main` immediately. Mitigated by baseline calibration and the review tier (AD-2, NFR11).
- **Inert class/interface metrics.** `wmc`/`npm`/`npa` are Java-oriented in v0.0.25 and likely emit zero/absent for TS. Mitigated by null-safe comparisons (absent → never fires) and bounded-but-permissive thresholds, confirmed at baseline (AD-2, FR5h, NFR11).
- **Determinism / no network at evaluation.** The binary is provisioned before evaluation; analysis touches only the source tree, no services (NFR2, NFR3, NFR7).
- **Divergence discoverability.** Host-only, out-of-aggregate, no-DinD, parse-and-enforce are non-obvious. Mitigated by explicit documentation in README, CONTRIBUTING, and a Makefile note mirroring the existing "intentionally not ported" block (AD-7, NFR10).

---

## Starter Template Evaluation

### Primary Technology Domain

Developer tooling / CI quality gate operating by **static metrics analysis of the TypeScript source tree**. There is no application runtime, UI, or data store in scope — the "system" is a committed policy plus an enforcement wrapper and build/CI wiring.

### Existing Conventions (Pre-Made Decisions)

The brownfield codebase has already decided the following; the architecture conforms, not relitigates:

- **Makefile is the single task runner:** per-tool `*_BIN` vars through `$(BIN_DIR)`, `## ` help descriptions, `CI ?= 0` / `PNPM_EXEC` dual-mode, dedicated workflows per gate. `package.json` has no `scripts`.
- **Gate analog:** `lint-deps` (dependency-cruiser) is the most recent gate — its Makefile target, `lint` aggregate membership, and `dependency-cruiser.yml` workflow are the template to mirror **except** where the Rust-binary fact forces divergence.
- **Scope precedent:** `.qlty/qlty.toml` `exclude_patterns` defines the repo's canonical "what isn't source we care about" list.
- **Shell-coverage discipline:** every Makefile target is inventoried in `tests/bats/make-target-coverage.tsv` and exercised by `make test-bats`.
- **CRM parity precedent:** the Makefile already names `lint-metrics` as an intentionally-not-yet-ported CRM target (lines 359-364) — this work ports it, adapted.

### Foundation Options Considered

| Option | Description | Verdict |
| --- | --- | --- |
| A. Verbatim CRM port (Docker `rca` Compose service) | Copy CRM's `lint-metrics` running inside a dedicated Docker `rca` stage + Compose service | **Rejected** — CRM is Docker-only; the website dev image has no Rust toolchain and the gate needs only the source tree on disk. A Docker stage adds image build/maintenance weight for zero benefit (NFR2). |
| B. ESLint complexity plugins (`complexity`, `sonarjs`) | Extend the existing ESLint config instead of adding a tool | **Rejected** — covers cyclomatic/cognitive only, not Halstead / MI / ABC / NOM / LOC families; breaks CRM cross-repo parity; no committed numeric policy with a schema. |
| C. `rust-code-analysis-cli` as a npm devDependency | Add it to `package.json` and run via `$(BIN_DIR)` | **Rejected** — it is not published to npm as a runnable binary for this purpose; forcing it through `node_modules`/`PNPM_EXEC` lands it in a container that cannot run it. |
| D. CRM implementation **adapted** to a host-only runner | Port `metrics-policy.json` + schema + `lint-metrics.sh`; provision a pinned host binary to `./bin`; run on the host; parse-and-enforce wrapper; dedicated workflow | **Selected** — closes the complexity gap, keeps CRM policy/script parity, respects the website's no-Rust-container reality, and is the simplest enforceable unit. |

### Selected Foundation

**Option D.** A pinned host binary at `./bin/rust-code-analysis-cli` (v0.0.25, SHA256-verified, auto-installed if absent), a committed `config/metrics-policy.json` (+ `metrics-policy.schema.json`) ported from CRM and re-baselined for the website, a host-only `scripts/ci/lint-metrics.sh` parse-and-enforce wrapper, a `make lint-metrics` target kept out of the `lint` aggregate and `CI_LINT_TARGETS` with no DinD wrapper, a dedicated `.github/workflows/rust-code-analysis.yml`, and README/CONTRIBUTING documentation.

### Initialization Command (brownfield — no new init)

This is a brownfield repository. There is no scaffolding/init step. The binary is provisioned (not committed) on first `make lint-metrics`; all config/script artifacts are authored by hand from the design below. The only host-side action is the pinned install:

```bash
# Performed by scripts/ci/ensure-rca.sh on first run (local) or in CI — not in this planning session:
curl -fsSL \
  https://github.com/mozilla/rust-code-analysis/releases/download/v0.0.25/rust-code-analysis-linux-cli-x86_64.tar.gz \
  -o rca.tar.gz
echo "9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894  rca.tar.gz" | sha256sum -c -
# extracted to ./bin/rust-code-analysis-cli   (./bin is gitignored)
# Non-amd64 / macOS fallback (no v0.0.25 prebuilt asset):
#   cargo install rust-code-analysis-cli --version 0.0.25 --locked
```

> Planning-artifacts-only constraint: this session does NOT create `config/metrics-policy.json`, `scripts/ci/lint-metrics.sh`, `scripts/ci/ensure-rca.sh`, edit the `Makefile`, `.gitignore`, or any workflow, or touch `src/`. Everything below is the authoritative description a future implementation story will apply.

### Blast-Radius Inventory

| Surface | Touched? | Effect |
| --- | --- | --- |
| `src/**` | No | Untouched. No behavioral change. |
| `pages/**`, `public/**` | No | Untouched (and out of scope — `src` only). |
| `package.json` | No | No devDependency, no `scripts` — the binary is not an npm package. |
| `.gitignore` | Yes | Add `/bin/` (host binary install dir, never committed). |
| `Makefile` | Yes | Add `RCA_*` vars + `lint-metrics` target + a "deliberate divergence" note; NO change to `lint` / `CI_LINT_TARGETS`. |
| `config/metrics-policy.json`, `config/metrics-policy.schema.json` | Yes (new) | Committed thresholds + schema. |
| `scripts/ci/lint-metrics.sh`, `scripts/ci/ensure-rca.sh` | Yes (new) | Enforcement wrapper + provisioning helper. |
| `.github/workflows/rust-code-analysis.yml` | Yes (new) | New required-check workflow. |
| `README.md`, `CONTRIBUTING.md` | Yes | New "Code Metrics" section + CONTRIBUTING subsection. |
| `tests/bats/make-target-coverage.tsv` (+ a bats test) | Yes | Record the new target for shell-coverage. |
| `./bin/rust-code-analysis-cli` | Yes (runtime, gitignored) | Provisioned on demand; never committed. |
| Application runtime / bundle | No | The gate never runs in `next build`. |

---

## Core Architectural Decisions

### Decision Priority Analysis

Decisions are ordered by dependency: the binary must exist before anything runs (AD-1); the policy + schema define what "too complex" means (AD-2); scope decides what is measured (AD-3); the wrapper turns metrics into a pass/fail with actionable output (AD-4); the Makefile makes it locally runnable while honoring the host-only divergences (AD-5); the dedicated workflow makes it an enforced required check (AD-6); documentation makes the divergences discoverable and the gate self-service (AD-7).

### AD-1: Pinned host-binary provisioning to `./bin`, SHA256-verified, auto-install-if-absent

**Decision:** Provision `rust-code-analysis-cli` as a **host binary** at `RCA_BIN = ./bin/rust-code-analysis-cli`, version-pinned to `RCA_VERSION = 0.0.25`, NOT as an npm devDependency under `$(BIN_DIR)`. A helper `scripts/ci/ensure-rca.sh` installs it if absent: download the pinned Linux release asset `rust-code-analysis-linux-cli-x86_64.tar.gz`, verify SHA256 `9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894`, extract to `./bin/`, and verify `--version`. `./bin/` is gitignored. For non-amd64 hosts (arm64) and macOS — where v0.0.25 ships no prebuilt asset — the documented fallback is `cargo install rust-code-analysis-cli --version 0.0.25 --locked`. (FR1, FR2)

**Rationale / NFR7 security:** Pinning the version + verifying the SHA256 (or `--locked` cargo) means an unexpected, mismatched, or tampered artifact cannot enter the build (NFR7). Installing to a project-local gitignored `./bin/` needs no `sudo`/system path and gives local and CI a **single provisioning path** for reproducibility (NFR4). The release tarball is fast and deterministic (~seconds) and requires no Rust toolchain — keeping the gate within the static-testing budget (NFR1) and host-runnable with no container (NFR2). Auto-install-if-absent means contributors run one command with no manual setup (FR2, NFR12). The asset name is load-bearing: the correct v0.0.25 Linux asset is `rust-code-analysis-linux-cli-x86_64.tar.gz` (the plausible-looking `…-x86_64-unknown-linux-gnu.tar.gz` does not exist and 404s). Windows asset (for local docs) is `rust-code-analysis-win-cli-x86_64.zip`; macOS has no v0.0.25 asset → cargo fallback.

**Files affected:**

```text
scripts/ci/ensure-rca.sh   [ADD]    download+verify+extract to ./bin; cargo fallback for non-amd64/macOS
.gitignore                 [MODIFY: add /bin/]
Makefile                   [MODIFY in-file: RCA_VERSION / RCA_BIN / RCA_SHA256_LINUX vars]
```

### AD-2: Committed `config/metrics-policy.json` + JSON Schema, two-tier hard/review, schema-validated

**Decision:** Commit `config/metrics-policy.json` as the single source of truth, with a sibling `config/metrics-policy.schema.json` (draft-07) the wrapper validates **before** enforcement. Every metric is classified `hard` (blocking) or `review` (computed, reported, never failing). The policy is **ported verbatim from CRM** as the starting point — all values are language-neutral and CRM is itself TypeScript — then flagged for re-baselining against the website's `src/` distribution before the check is made required. (FR3, FR4, FR5, FR5a–FR5i)

**Rationale / TS-specific reasoning:** rust-code-analysis computes the same metrics for TS/TSX as for any tree-sitter language, so the CRM hard set (cyclomatic, cognitive, Halstead volume/bugs, LOC families, ABC, NARGS, NEXITS, NOM, MI floor) applies directly. Per-metric TS notes: **ABC magnitude** (assignments/branches/conditions) is fully meaningful for TS — kept hard at `17`, confirmed at baseline. **MI floor** uses `mi_visual_studio` reading `metrics.mi` with the legacy misspelled `metrics.maintanability_index` fallback; CRM calibrated this low (`min: 20`) from its own distribution, so the website value is a placeholder to re-baseline; `mi_original`/`mi_sei` stay review. **Class/interface metrics** (`wmc`, `npm`, `npa`, `coa`, `cda`, interface `npm`/`npa`) are syntactically present in TS but Java-oriented in v0.0.25 and will likely emit zero/absent — kept hard but bounded-permissive for forward-compat; the wrapper's null-safe comparison (`($value // 0) > max`) means absent values never fire, so they are safe to keep and must be **confirmed inert at baseline** (FR5h, NFR11). **Comment/blank ratios** use band (`min..max`) logic distinct from `value > max` and stay review until their distribution is validated (FR5i). No metric is removed; the value tuning is what the baseline run owns.

**Files affected:**

```text
config/metrics-policy.json          [ADD]    hard{27 keys} + review{32 keys}
config/metrics-policy.schema.json   [ADD]    draft-07, required:["hard"], additionalProperties:false, per-key bounds
```

### AD-3: Analysis scope — `src` restricted to `*.ts`/`*.tsx`, exclusions aligned to `.qlty`

**Decision:** Analyze `RCA_SCOPE = src` only, filtered with rust-code-analysis include/exclude globs: include `*.ts` and `*.tsx` (`-I '*.ts' -I '*.tsx'`), exclude `*/test/*`, `*.d.ts`, `*/assets/*`, `*/config/*` (`-X` per pattern). `*.js`/`*.jsx` are skipped (the sole production `.js`, `src/config/i18nConfig.js`, is doubly excluded by both the `*.js` skip and `*/config/*`). The full governed scope is evaluated every run (no changed-files mode). Build outputs (`out/`, `.next/`), `node_modules`, and `specs/**` are naturally outside `-p src` and are not re-scanned. (FR6, FR7, FR8)

**Rationale:** TS/TSX is the meaningful complexity surface; analyzing `.js` would only pull in test/config noise (every `.js` under `src` is test or the excluded i18n config). The exclusions mirror the repo's existing `.qlty/qlty.toml` `exclude_patterns` (`**/*.d.ts`, `**/assets/**`, `**/config/**`) plus `src/test` — the dependency-cruiser precedent of exempting tests. Full-scope evaluation keeps coverage uniform across PRs (FR8) and is cheap because rust-code-analysis is source-only (NFR1, NFR2). Scope and exclusions live in the Makefile var block as the single source of truth shared with CI (NFR9).

**Files affected:**

```text
Makefile   [MODIFY in-file: RCA_SCOPE / RCA_INCLUDES / RCA_EXCLUDES vars]
```

### AD-4: Host-only `scripts/ci/lint-metrics.sh` parse-and-enforce wrapper (POSIX sh + jq)

**Decision:** Port CRM's proven `scripts/lint-metrics.sh` to `scripts/ci/lint-metrics.sh` (POSIX `sh`, `set -eu`, `jq`). It (1) requires `jq`; (2) validates `METRICS_POLICY` exists and is valid JSON; (3) validates it against `METRICS_POLICY_SCHEMA` via an in-script jq validator (unknown/missing keys, non-numeric, bound violations → exit 1); (4) loads `hard.*` (required) and `review.*` (optional, script defaults) thresholds; (5) runs `"$RCA_BIN" -m -O json -p "$RCA_SCOPE"` with `-I` includes and `-X` excludes built in a `set -f` loop, writing NDJSON to a temp file; (6) walks each file's function/closure spaces and the file aggregate with a `jq -rs` program, emitting `severity|file|scope|subject|line|metric|value|limit` rows where severity is `FAIL` for hard and `REVIEW` for review; (7) counts only `FAIL` rows; (8) prints a measured-metrics summary and an aligned violation table, mirrors them into `$GITHUB_STEP_SUMMARY` when set, and exits `1` only after reporting all hard violations (collect-all-then-fail) or `0` on a clean run. The MI read uses the load-bearing fallback `(.metrics.mi // .metrics.maintanability_index)`; null-safe `gt`/`lt`/`range` helpers make absent metrics never fire. (FR9, FR11, FR12, NFR5, NFR6)

**Rationale:** The CLI never self-fails, so the wrapper owns the exit-code contract (FR9, NFR5). Collect-all-then-fail lets a contributor remediate every breach in one pass (FR11). The pipe-delimited rows carry exactly the actionable fields — file, function/scope, start line, metric, measured value, breached threshold — so failures are self-explanatory without reading raw JSON (FR12, NFR6). `REVIEW` rows are computed but never printed and never affect the exit code, realizing the two-tier model (FR5). Relocating from CRM's `scripts/lint-metrics.sh` to `scripts/ci/lint-metrics.sh` matches the website's existing `scripts/ci/` home (alongside `run-parallel.sh`). The wrapper runs **on the host** — the Makefile invokes it directly, never through `PNPM_EXEC`/`docker compose run rca` (the website's no-Rust-container divergence from CRM, which wrapped this same script in a Docker `rca` service).

**Files affected:**

```text
scripts/ci/lint-metrics.sh   [ADD]    POSIX-sh enforcement wrapper (ported from CRM, +`-I` include loop, host-run)
```

### AD-5: Makefile `lint-metrics` target — host-only, OUT of the `lint` aggregate and `CI_LINT_TARGETS`, NO DinD wrapper

**Decision:** Add the `RCA_*` var block (per the aligned `*_BIN` style, with a clarifying comment that `RCA_BIN` is intentionally NOT a `$(BIN_DIR)/...` entry) and a single host-only target:

```makefile
lint-metrics: ## Run rust-code-analysis complexity gate on src (host-only; auto-installs the pinned CLI to ./bin)
	@scripts/ci/ensure-rca.sh
	@RCA_BIN="$(RCA_BIN)" RCA_VERSION="$(RCA_VERSION)" RCA_SCOPE="$(RCA_SCOPE)" \
	 RCA_INCLUDES="$(RCA_INCLUDES)" RCA_EXCLUDES="$(RCA_EXCLUDES)" \
	 METRICS_POLICY="$(METRICS_POLICY_PATH)" \
	 sh scripts/ci/lint-metrics.sh
```

It does **NOT** use `$(PNPM_EXEC)`. It is **kept out of** both the `lint` aggregate (`lint: lint-next lint-tsc lint-md lint-deps` stays unchanged) and `CI_LINT_TARGETS` (`lint-next lint-tsc lint-md` stays unchanged). It ships **no** `run-*-dind` wrapper. Its only CI surface is the dedicated workflow (AD-6). The trailing `## ` makes it appear in `make help`. A Makefile comment block (mirroring the existing lines 353-373 "intentionally not ported" note) records why these omissions are deliberate. (FR9, FR10, NFR2, NFR10)

**Rationale:** Every existing lint target runs `$(PNPM_EXEC) $(TOOL_BIN)` — in the dev container by default, on the runner under `CI=1`. The dev container has no Rust binary, so `lint-metrics` must bypass `PNPM_EXEC` entirely and run host-only in both modes (FR9). Adding it to `make lint` would break local `make lint` inside the container and force `static-testing.yml`'s `make lint` to need the Rust binary; adding it to `CI_LINT_TARGETS` would route it through `run-parallel.sh` → plain `make lint-metrics` → (in no-flag mode) the dev container. Both are wrong, so the target stays out of both (FR10). A `run-metrics-lint-tests-dind` wrapper would have to first install the Rust binary into the temp container — defeating the purpose — so it is omitted. These are the load-bearing divergences from the `lint-deps` playbook and are documented in-place (NFR10). `ensure-rca.sh` runs first so a missing binary self-heals before evaluation.

**Files affected:**

```text
Makefile   [MODIFY in-file: RCA_* var block; lint-metrics target; divergence note]
           [UNCHANGED: lint aggregate (line 292); CI_LINT_TARGETS (line 108)]
```

### AD-6: Dedicated CI workflow `rust-code-analysis.yml` (no Node/pnpm; pinned CLI install)

**Decision:** Add `.github/workflows/rust-code-analysis.yml` on `pull_request -> branches:[main]`, display name `rust code analysis`, job key `rust-code-analysis` (the required-check name). Top-level `permissions: {}`; job `permissions: contents: read`; `env: CI: 1`; `concurrency: { group: rca-${{ github.ref }}, cancel-in-progress: true }`; `timeout-minutes: 10`; SHA-pinned `actions/checkout` with `persist-credentials: false`. Steps: (1) checkout; (2) install the pinned CLI (`scripts/ci/ensure-rca.sh`, SHA256-verified); (3) `make lint-metrics CI=1`. It **omits** the Node/pnpm setup, cache, and `make install` steps that `dependency-cruiser.yml` carries — the analyzer reads files directly and needs no `node_modules`. (FR13, FR14, FR15, FR16, FR17, NFR8)

**Rationale / no-Node justification:** `rust-code-analysis-cli` is self-contained; it needs neither `node_modules`, a built app, nor pnpm. Dropping setup-node/cache/install keeps the job minimal and within budget (NFR1) and avoids provisioning that does nothing for this gate. The job key must equal `rust-code-analysis` exactly so it is selectable as a branch-protection required check (GitHub only exposes it after ≥1 run). Hardened permissions (`{}` top-level, `contents: read` job), the SHA-pinned checkout, and `persist-credentials: false` satisfy least-privilege (NFR8, FR16). The CLI is provisioned via the **same** `ensure-rca.sh` as local (one provisioning path → NFR4); `cargo install --locked` is the documented non-amd64 fallback. A passing run prints the measured-metric summary (FR17); a hard breach exits non-zero and fails the required check (FR15, NFR5). `env: CI: 1` is set for house-style uniformity though it is inert for this host-only target.

**Files affected:**

```text
.github/workflows/rust-code-analysis.yml   [ADD]
```

### AD-7: README + CONTRIBUTING documentation and bats shell-coverage

**Decision:** Add a README "## Code Metrics (rust-code-analysis)" section modeled on the existing "## Architecture Rules (dependency-cruiser)" section (subsections **What is enforced**, **Running it**, **Adding an exception/raising a budget**), a `make lint-metrics:` line under "Linting & Formatting", a CONTRIBUTING "#### Code metrics (rust-code-analysis)" subsection under "Make Changes" (modeled on the "Dockerfile build performance" subsection), record `lint-metrics` in `tests/bats/make-target-coverage.tsv` with a bats test, and document the deliberate divergences (host-only, out-of-aggregate, no DinD, parse-and-enforce). The README threshold mirror is flagged "must be kept in sync with `config/metrics-policy.json`". (FR18, FR19, FR20, FR21, NFR9, NFR10)

**Rationale:** Documentation converts the gate from a surprising roadblock (missing from `make lint`) into a self-service tool, explains how to read failures and raise a budget through the committed policy (not a silent local override), and keeps Makefile shell-coverage complete (`make test-bats` is mandatory for any new target). The "raise a budget" guidance steers contributors to a reviewed, in-repo policy diff (FR21).

**Files affected:**

```text
README.md                              [MODIFY: "## Code Metrics (rust-code-analysis)" + command list line]
CONTRIBUTING.md                        [MODIFY: "#### Code metrics (rust-code-analysis)" subsection]
tests/bats/make-target-coverage.tsv    [MODIFY: add lint-metrics row]
tests/bats/*.bats                      [MODIFY/ADD: assert lint-metrics provisioning + enforcement contract]
```

### Decision Impact Analysis

| Decision | Enables FRs | Satisfies NFRs | Risk if skipped |
| --- | --- | --- | --- |
| AD-1 Pinned host-binary provisioning | FR1, FR2 | NFR2, NFR4, NFR7 | No runnable analyzer; or an unpinned/tampered binary enters the build. |
| AD-2 Policy + schema, two-tier | FR3, FR4, FR5, FR5a–FR5i | NFR9, NFR11 | No definition of "too complex"; malformed policy mis-gates silently. |
| AD-3 Scope + exclusions | FR6, FR7, FR8 | NFR1, NFR2 | Test/generated/config noise inflates metrics; false failures. |
| AD-4 Parse-and-enforce wrapper | FR9, FR11, FR12 | NFR5, NFR6 | Metrics emit but nothing fails; no actionable output. |
| AD-5 Makefile wiring (host-only, out-of-aggregate) | FR9, FR10 | NFR2, NFR10 | `make lint` breaks in-container; gate routed into a container that cannot run it. |
| AD-6 Dedicated workflow | FR13, FR14, FR15, FR16, FR17 | NFR1, NFR8 | No automated required check; over-privileged or Node-bloated job. |
| AD-7 Docs + bats coverage | FR18, FR19, FR20, FR21 | NFR9, NFR10 | Divergences undiscoverable; silent budget overrides; shell-coverage gap. |

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

- **Makefile vars:** `RCA_VERSION`, `RCA_BIN`, `RCA_SCOPE`, `RCA_INCLUDES`, `RCA_EXCLUDES`, `METRICS_POLICY_PATH`, `RCA_SHA256_LINUX` — UPPER_SNAKE, right-aligned `=`, per the existing var block.
- **Target:** `lint-metrics` (kebab-case), trailing `## ` description for `make help`.
- **Scripts:** `scripts/ci/lint-metrics.sh` (enforcement), `scripts/ci/ensure-rca.sh` (provisioning) — under the existing `scripts/ci/` home.
- **Config:** `config/metrics-policy.json`, `config/metrics-policy.schema.json`.
- **Workflow:** file `rust-code-analysis.yml`; display name `rust code analysis`; job key/required-check `rust-code-analysis`.
- **Metric/threshold keys:** `<metric>_<scope>_<bound>` exactly as in `config/metrics-policy.json` (e.g. `cyclomatic_max`, `mi_visual_studio_min`, `halstead_bugs_file_max`).

### Structure Patterns

- Policy + schema live under `config/`; enforcement + provisioning under `scripts/ci/`; the binary under gitignored `./bin/`.
- The wrapper reads thresholds from the policy via env (`METRICS_POLICY`), never hardcodes them.
- The Makefile var block is the single source of scope/excludes/version, shared by local and CI.

### Format Patterns

- Policy: two top-level objects `hard` and `review`, numeric values only; schema is draft-07 with `required:["hard"]`, `additionalProperties:false`, per-key `minimum`/`maximum`.
- Wrapper output: aligned stdout tables (`GATE FILE SCOPE SUBJECT LINE METRIC VALUE LIMIT`) and a Markdown mirror to `$GITHUB_STEP_SUMMARY` when set.
- Workflow YAML: hardened-permissions skeleton, SHA-pinned actions with `# vX.Y.Z` comments.

### Communication Patterns

- Tool → wrapper: NDJSON on stdout (one object per file; nested function/closure spaces).
- Wrapper → developer: pipe-delimited findings rendered as aligned tables; FAIL rows only.
- CI → PR: non-zero exit on any hard violation → failed required check; review breaches reported, never failing.
- Maintainer → maintainer: a budget change is a reviewed edit to `config/metrics-policy.json` visible in the diff.

### Process Patterns

- Local: `make lint-metrics` (host; auto-provisions the binary) before pushing.
- CI: dedicated workflow installs the pinned CLI, runs `make lint-metrics CI=1`.
- Coverage: any Makefile target change updates `tests/bats/make-target-coverage.tsv` + `make test-bats`.

### Enforcement Guidelines

**All AI Agents MUST:**

- Keep `config/metrics-policy.json` the single source of truth; never hardcode thresholds into the wrapper or duplicate them outside the flagged README mirror.
- Provision the binary only via the pinned, SHA256-verified `scripts/ci/ensure-rca.sh` (or `cargo --locked`); never fetch an unpinned/unverified binary.
- Keep `lint-metrics` host-only — never route it through `$(PNPM_EXEC)`, the `lint` aggregate, `CI_LINT_TARGETS`, or a DinD wrapper.
- Preserve the two-tier contract: only `hard` breaches fail; `review` is computed and reported.
- Preserve the MI fallback `(.metrics.mi // .metrics.maintanability_index)` and null-safe comparisons so absent (TS-inert) metrics never fire.
- Re-baseline thresholds against the website `src/` before the check is made required; confirm class/interface metrics are inert.

**Anti-Patterns:**

- Adding `rust-code-analysis-cli` as an npm devDependency or running it through the dev container.
- Adding `lint-metrics` to `make lint` / `CI_LINT_TARGETS`, or adding a `run-metrics-lint-tests-dind` wrapper.
- Hardcoding thresholds, or disabling a metric to silence one file instead of a reviewed policy edit.
- Using an unverified or floating-version binary; running analysis with network access at evaluation time.
- Adopting CRM's Docker `rca` Compose service (the website has no Rust container).

---

## Project Structure & Boundaries

### Requirements to File Mapping

| Requirement(s) | File / Artifact | Decision |
| --- | --- | --- |
| FR1, FR2, NFR7 | `scripts/ci/ensure-rca.sh`, `Makefile` (`RCA_*` vars), `.gitignore` (`/bin/`) | AD-1 |
| FR3, FR5, FR5a–FR5i | `config/metrics-policy.json` | AD-2 |
| FR4 | `config/metrics-policy.schema.json` + in-script validator | AD-2 / AD-4 |
| FR6, FR7, FR8 | `Makefile` (`RCA_SCOPE`/`RCA_INCLUDES`/`RCA_EXCLUDES`) | AD-3 |
| FR9, FR11, FR12, NFR5, NFR6 | `scripts/ci/lint-metrics.sh` | AD-4 |
| FR9, FR10, NFR2, NFR10 | `Makefile` (`lint-metrics` target; unchanged aggregate/`CI_LINT_TARGETS`) | AD-5 |
| FR13, FR14, FR15, FR16, FR17, NFR8 | `.github/workflows/rust-code-analysis.yml` | AD-6 |
| FR18, FR19, FR20, FR21, NFR9 | `README.md`, `CONTRIBUTING.md`, `tests/bats/make-target-coverage.tsv` | AD-7 |
| NFR3, NFR4 | pinned version + committed policy applied identically local↔CI | AD-1/AD-2/AD-6 |
| NFR11, NFR12 | baseline calibration + single `make lint-metrics` command | AD-2/AD-5 |

### Complete File Change Map

```text
website/
├── .gitignore                                  [MODIFY] + /bin/
├── Makefile                                    [MODIFY] RCA_* vars; lint-metrics target (host-only);
│                                                         divergence note. lint aggregate & CI_LINT_TARGETS UNCHANGED
├── config/
│   ├── metrics-policy.json                     [ADD]    hard{27} + review{32} (baseline-calibrated)
│   └── metrics-policy.schema.json              [ADD]    draft-07; required:["hard"]; per-key bounds
├── scripts/
│   └── ci/
│       ├── ensure-rca.sh                       [ADD]    pinned download + SHA256 verify → ./bin; cargo fallback
│       └── lint-metrics.sh                     [ADD]    POSIX-sh parse-and-enforce wrapper (ported from CRM)
├── .github/
│   └── workflows/
│       └── rust-code-analysis.yml              [ADD]    PR->main gate: checkout(SHA-pinned) + install CLI + make lint-metrics CI=1
├── README.md                                   [MODIFY] "## Code Metrics (rust-code-analysis)" + command line
├── CONTRIBUTING.md                             [MODIFY] "#### Code metrics (rust-code-analysis)" subsection
├── tests/bats/
│   ├── make-target-coverage.tsv                [MODIFY] + lint-metrics row
│   └── *.bats                                  [MODIFY/ADD] provisioning + enforcement contract
├── bin/                                        (gitignored — host binary provisioned on demand)
└── src/                                         (UNCHANGED — governed, never modified)
    ├── features/{documentation,example,landing,registration,swagger}/   (analyzed: *.ts/*.tsx)
    ├── components/ · hooks/ · lib/ · providers/ · routes/ · shared/ · stores/ · types/ · utils/  (analyzed)
    ├── test/                                    (EXCLUDED -X '*/test/*')
    ├── assets/ · config/                        (EXCLUDED -X '*/assets/*' '*/config/*')
    └── react-app-env.d.ts                       (EXCLUDED -X '*.d.ts')
```

### Complete Drop-In `config/metrics-policy.json`

> Ready to commit. Ported verbatim from CRM (all values language-neutral); the `hard` numbers are a **baseline-calibrated placeholder** — re-run `make lint-metrics` against the website `src/` and adjust before registering the required check (NFR11). `class_*`/`interface_*` are forward-compat and expected inert for TS in v0.0.25 — confirm at baseline.

```json
{
  "hard": {
    "cyclomatic_max": 10,
    "cognitive_max": 15,
    "abc_magnitude_max": 17,
    "nargs_function_max": 3,
    "nargs_closure_max": 3,
    "nexits_max": 3,
    "lloc_function_max": 10,
    "ploc_function_max": 40,
    "sloc_function_max": 45,
    "halstead_volume_function_max": 1000,
    "halstead_bugs_function_max": 0.35,
    "nom_functions_file_max": 10,
    "nom_closures_file_max": 6,
    "nom_total_file_max": 15,
    "lloc_file_max": 120,
    "ploc_file_max": 300,
    "sloc_file_max": 350,
    "halstead_volume_file_max": 8000,
    "halstead_bugs_file_max": 1.58,
    "mi_visual_studio_min": 20,
    "class_wmc_max": 30,
    "class_npm_max": 8,
    "class_npa_max": 2,
    "class_coa_max": 0.6,
    "class_cda_max": 0.25,
    "interface_npm_max": 10,
    "interface_npa_max": 15
  },
  "review": {
    "mi_original_min": 65,
    "mi_sei_min": 65,
    "cloc_ratio_min": 0.1,
    "cloc_ratio_max": 0.6,
    "blank_ratio_min": 0.02,
    "blank_ratio_max": 0.3,
    "halstead_n1_function_max": 30,
    "halstead_n1_total_function_max": 80,
    "halstead_n2_function_max": 40,
    "halstead_n2_total_function_max": 120,
    "halstead_length_function_max": 180,
    "halstead_estimated_length_function_max": 160,
    "halstead_vocabulary_function_max": 70,
    "halstead_difficulty_function_max": 25,
    "halstead_level_function_min": 0.03,
    "halstead_effort_function_max": 30000,
    "halstead_time_function_max": 1800,
    "halstead_purity_ratio_function_min": 0.6,
    "halstead_purity_ratio_function_max": 1.4,
    "halstead_n1_file_max": 60,
    "halstead_n1_total_file_max": 400,
    "halstead_n2_file_max": 90,
    "halstead_n2_total_file_max": 800,
    "halstead_length_file_max": 1000,
    "halstead_estimated_length_file_max": 850,
    "halstead_vocabulary_file_max": 140,
    "halstead_difficulty_file_max": 40,
    "halstead_level_file_min": 0.02,
    "halstead_effort_file_max": 250000,
    "halstead_time_file_max": 15000,
    "halstead_purity_ratio_file_min": 0.6,
    "halstead_purity_ratio_file_max": 1.4
  }
}
```

### Complete Drop-In `config/metrics-policy.schema.json`

> Draft-07. `required:["hard"]`, `additionalProperties:false`. The wrapper enforces this at runtime via an in-script jq validator (unknown/missing keys, non-numeric, `minimum`/`maximum` breaches → exit 1).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "metrics-policy.schema.json",
  "title": "Metrics Policy",
  "description": "rust-code-analysis threshold policy for lint-metrics enforcement",
  "type": "object",
  "required": ["hard"],
  "additionalProperties": false,
  "properties": {
    "hard": {
      "type": "object",
      "description": "Hard-fail thresholds — violations block CI",
      "required": [
        "cyclomatic_max", "cognitive_max", "abc_magnitude_max",
        "nargs_function_max", "nargs_closure_max", "nexits_max",
        "lloc_function_max", "ploc_function_max", "sloc_function_max",
        "halstead_volume_function_max", "halstead_bugs_function_max",
        "nom_functions_file_max", "nom_closures_file_max", "nom_total_file_max",
        "lloc_file_max", "ploc_file_max", "sloc_file_max",
        "halstead_volume_file_max", "halstead_bugs_file_max",
        "mi_visual_studio_min",
        "class_wmc_max", "class_npm_max", "class_npa_max", "class_coa_max", "class_cda_max",
        "interface_npm_max", "interface_npa_max"
      ],
      "additionalProperties": false,
      "properties": {
        "cyclomatic_max": { "type": "number", "minimum": 1 },
        "cognitive_max": { "type": "number", "minimum": 1 },
        "abc_magnitude_max": { "type": "number", "minimum": 1 },
        "nargs_function_max": { "type": "number", "minimum": 1 },
        "nargs_closure_max": { "type": "number", "minimum": 1 },
        "nexits_max": { "type": "number", "minimum": 1 },
        "lloc_function_max": { "type": "number", "minimum": 1 },
        "ploc_function_max": { "type": "number", "minimum": 1 },
        "sloc_function_max": { "type": "number", "minimum": 1 },
        "halstead_volume_function_max": { "type": "number", "minimum": 0 },
        "halstead_bugs_function_max": { "type": "number", "minimum": 0 },
        "nom_functions_file_max": { "type": "number", "minimum": 1 },
        "nom_closures_file_max": { "type": "number", "minimum": 1 },
        "nom_total_file_max": { "type": "number", "minimum": 1 },
        "lloc_file_max": { "type": "number", "minimum": 1 },
        "ploc_file_max": { "type": "number", "minimum": 1 },
        "sloc_file_max": { "type": "number", "minimum": 1 },
        "halstead_volume_file_max": { "type": "number", "minimum": 0 },
        "halstead_bugs_file_max": { "type": "number", "minimum": 0 },
        "mi_visual_studio_min": { "type": "number", "minimum": 0, "maximum": 100 },
        "class_wmc_max": { "type": "number", "minimum": 1 },
        "class_npm_max": { "type": "number", "minimum": 1 },
        "class_npa_max": { "type": "number", "minimum": 0 },
        "class_coa_max": { "type": "number", "minimum": 0, "maximum": 1 },
        "class_cda_max": { "type": "number", "minimum": 0, "maximum": 1 },
        "interface_npm_max": { "type": "number", "minimum": 1 },
        "interface_npa_max": { "type": "number", "minimum": 0 }
      }
    },
    "review": {
      "type": "object",
      "description": "Review-gate thresholds — calculated but do not block CI",
      "additionalProperties": false,
      "properties": {
        "mi_original_min": { "type": "number", "minimum": 0, "maximum": 100 },
        "mi_sei_min": { "type": "number", "minimum": 0, "maximum": 100 },
        "cloc_ratio_min": { "type": "number", "minimum": 0, "maximum": 1 },
        "cloc_ratio_max": { "type": "number", "minimum": 0, "maximum": 1 },
        "blank_ratio_min": { "type": "number", "minimum": 0, "maximum": 1 },
        "blank_ratio_max": { "type": "number", "minimum": 0, "maximum": 1 },
        "halstead_n1_function_max": { "type": "number", "minimum": 1 },
        "halstead_n1_total_function_max": { "type": "number", "minimum": 1 },
        "halstead_n2_function_max": { "type": "number", "minimum": 1 },
        "halstead_n2_total_function_max": { "type": "number", "minimum": 1 },
        "halstead_length_function_max": { "type": "number", "minimum": 1 },
        "halstead_estimated_length_function_max": { "type": "number", "minimum": 1 },
        "halstead_vocabulary_function_max": { "type": "number", "minimum": 1 },
        "halstead_difficulty_function_max": { "type": "number", "minimum": 1 },
        "halstead_level_function_min": { "type": "number", "minimum": 0 },
        "halstead_effort_function_max": { "type": "number", "minimum": 0 },
        "halstead_time_function_max": { "type": "number", "minimum": 0 },
        "halstead_purity_ratio_function_min": { "type": "number", "minimum": 0 },
        "halstead_purity_ratio_function_max": { "type": "number", "minimum": 0 },
        "halstead_n1_file_max": { "type": "number", "minimum": 1 },
        "halstead_n1_total_file_max": { "type": "number", "minimum": 1 },
        "halstead_n2_file_max": { "type": "number", "minimum": 1 },
        "halstead_n2_total_file_max": { "type": "number", "minimum": 1 },
        "halstead_length_file_max": { "type": "number", "minimum": 1 },
        "halstead_estimated_length_file_max": { "type": "number", "minimum": 1 },
        "halstead_vocabulary_file_max": { "type": "number", "minimum": 1 },
        "halstead_difficulty_file_max": { "type": "number", "minimum": 1 },
        "halstead_level_file_min": { "type": "number", "minimum": 0 },
        "halstead_effort_file_max": { "type": "number", "minimum": 0 },
        "halstead_time_file_max": { "type": "number", "minimum": 0 },
        "halstead_purity_ratio_file_min": { "type": "number", "minimum": 0 },
        "halstead_purity_ratio_file_max": { "type": "number", "minimum": 0 }
      }
    }
  }
}
```

### `scripts/ci/ensure-rca.sh` (to be added)

```bash
#!/usr/bin/env sh
# Provision the pinned rust-code-analysis-cli into ./bin (idempotent, SHA256-verified).
set -eu

RCA_BIN="${RCA_BIN:-./bin/rust-code-analysis-cli}"
RCA_VERSION="${RCA_VERSION:-0.0.25}"
RCA_SHA256_LINUX="${RCA_SHA256_LINUX:-9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894}"

# Already the right version? Nothing to do.
if [ -x "$RCA_BIN" ] && "$RCA_BIN" --version 2>/dev/null | grep -q "$RCA_VERSION"; then
  exit 0
fi

# Prebuilt asset exists for linux x86_64 only. Fall back to a locked cargo build elsewhere.
arch="$(uname -m)"; os="$(uname -s)"
if [ "$os" != "Linux" ] || { [ "$arch" != "x86_64" ] && [ "$arch" != "amd64" ]; }; then
  printf 'No v%s prebuilt asset for %s/%s; building with cargo (locked)...\n' "$RCA_VERSION" "$os" "$arch" >&2
  command -v cargo >/dev/null 2>&1 || { printf 'ERROR: cargo required for non-amd64/macOS provisioning\n' >&2; exit 1; }
  cargo install rust-code-analysis-cli --version "$RCA_VERSION" --locked --root "$(dirname "$(dirname "$RCA_BIN")")/.cargo-rca"
  ln -sf "$(dirname "$(dirname "$RCA_BIN")")/.cargo-rca/bin/rust-code-analysis-cli" "$RCA_BIN"
  exit 0
fi

mkdir -p "$(dirname "$RCA_BIN")"
asset="rust-code-analysis-linux-cli-x86_64.tar.gz"
url="https://github.com/mozilla/rust-code-analysis/releases/download/v${RCA_VERSION}/${asset}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/rca-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fsSL "$url" -o "$tmp/$asset"
printf '%s  %s\n' "$RCA_SHA256_LINUX" "$tmp/$asset" | sha256sum -c -
tar -xzf "$tmp/$asset" -C "$tmp"
install -m 0755 "$tmp/rust-code-analysis-cli" "$RCA_BIN"
"$RCA_BIN" --version
```

### `scripts/ci/lint-metrics.sh` (to be added — ported from CRM, host-run, with an include-glob loop)

> Ported near-verbatim from CRM's proven `scripts/lint-metrics.sh` (the full two-tier jq findings/summary program is reproduced there). The website adaptations are: default `RCA_BIN=./bin/rust-code-analysis-cli`, schema default `config/metrics-policy.schema.json`, and an added `-I` include loop so only `*.ts`/`*.tsx` are analyzed. Exit `0` = no hard violations; exit `1` = one or more hard violations (collect-all-then-fail). Load-bearing details preserved: MI fallback `(.metrics.mi // .metrics.maintanability_index)`, null-safe `gt`/`lt`/`range`, `FAIL` (hard) vs `REVIEW` (non-blocking) severities, and the `$GITHUB_STEP_SUMMARY` null-guard.

```bash
#!/usr/bin/env sh
# scripts/ci/lint-metrics.sh — rust-code-analysis metrics enforcement for src/
set -eu

command -v jq >/dev/null 2>&1 || { printf 'ERROR: jq required by lint-metrics\n' >&2; exit 1; }

RCA_BIN="${RCA_BIN:-./bin/rust-code-analysis-cli}"
RCA_VERSION="${RCA_VERSION:-}"
RCA_SCOPE="${RCA_SCOPE:-src}"
METRICS_POLICY_SCHEMA="${METRICS_POLICY_SCHEMA:-config/metrics-policy.schema.json}"

# 1. Policy + schema presence/validity (exit 1 on any failure) ......... (as CRM)
# 2. In-script jq schema validation of $METRICS_POLICY ................. (as CRM)
# 3. Load hard.* (required) + review.* (script-defaulted) thresholds ... (as CRM)
[ -n "${RCA_EXCLUDES:-}" ] || { printf 'ERROR: RCA_EXCLUDES must be set\n' >&2; exit 1; }
[ -x "$RCA_BIN" ] || { printf 'ERROR: %s not found/executable (run scripts/ci/ensure-rca.sh)\n' "$RCA_BIN" >&2; exit 1; }

# 4. Build the analyzer invocation: TS/TSX includes + exclusions.
set -- -m -O json -p "$RCA_SCOPE"
set -f
for include_pattern in ${RCA_INCLUDES:-}; do set -- "$@" -I "$include_pattern"; done
for exclude_pattern in $RCA_EXCLUDES;      do set -- "$@" -X "$exclude_pattern"; done
set +f
"$RCA_BIN" "$@" >"$TMP_JSON"

# 5. jq -rs findings pass: per-function + per-file rows
#      severity|file|scope|subject|line|metric|value|limit
#    FAIL for hard metrics, REVIEW for review metrics; MI read via
#    (.metrics.mi // .metrics.maintanability_index); null-safe gt/lt/range. (as CRM)
# 6. FAIL_COUNT = count of FAIL rows only.
# 7. Report measured-metrics summary + aligned violation table to stdout;
#    mirror Markdown tables to $GITHUB_STEP_SUMMARY when set; exit 1 only after
#    all hard violations are reported, else exit 0. (as CRM, collect-all-then-fail)
```

### Makefile `RCA_*` variables and `lint-metrics` recipe (to be added)

```makefile
# --- variable block, alongside the existing per-tool *_BIN vars (lines ~16-26) ---
# rust-code-analysis is a host-installed Rust binary (release tarball / cargo),
# NOT an npm dep under $(BIN_DIR); pin the version for reproducibility and install
# it to the gitignored ./bin so local and CI share one provisioning path.
RCA_VERSION                 = 0.0.25
RCA_BIN                     = ./bin/rust-code-analysis-cli
RCA_SCOPE                   = src
RCA_INCLUDES                = *.ts *.tsx
RCA_EXCLUDES                = */test/* *.d.ts */assets/* */config/*
METRICS_POLICY_PATH         = config/metrics-policy.json
RCA_SHA256_LINUX            = 9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894

# --- target, alongside lint-next / lint-tsc / lint-md / lint-deps (lines ~280-292) ---
# DELIBERATE DIVERGENCE FROM THE npm-tool LINT GATES (lint-next/tsc/md/deps):
#   * Host-only: rust-code-analysis is a Rust binary absent from the dev image,
#     so this target does NOT use $(PNPM_EXEC) and runs on the host in both modes.
#   * NOT in `lint` aggregate and NOT in CI_LINT_TARGETS (both route through the
#     dev container / run-parallel.sh, which cannot run the binary).
#   * NO run-metrics-lint-tests-dind wrapper (it would have to install Rust into
#     the temp container). Its only CI surface is rust-code-analysis.yml.
# rust-code-analysis-cli only EMITS metrics; scripts/ci/lint-metrics.sh parses them
# against config/metrics-policy.json and owns the non-zero exit on hard breaches.
lint-metrics: ## Run rust-code-analysis complexity gate on src (host-only; auto-installs the pinned CLI to ./bin)
	@scripts/ci/ensure-rca.sh
	@RCA_BIN="$(RCA_BIN)" RCA_VERSION="$(RCA_VERSION)" RCA_SCOPE="$(RCA_SCOPE)" \
	 RCA_INCLUDES="$(RCA_INCLUDES)" RCA_EXCLUDES="$(RCA_EXCLUDES)" \
	 RCA_SHA256_LINUX="$(RCA_SHA256_LINUX)" \
	 METRICS_POLICY="$(METRICS_POLICY_PATH)" \
	 sh scripts/ci/lint-metrics.sh

# --- lint aggregate and CI_LINT_TARGETS are intentionally UNCHANGED ---
# lint: lint-next lint-tsc lint-md lint-deps          (line 292 — unchanged)
# CI_LINT_TARGETS = lint-next lint-tsc lint-md         (line 108 — unchanged)
```

### `.github/workflows/rust-code-analysis.yml` (to be added)

```yaml
name: rust code analysis
on:
  pull_request:
    branches:
      - main

permissions: {}

concurrency:
  group: rca-${{ github.ref }}
  cancel-in-progress: true

jobs:
  rust-code-analysis:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    env:
      CI: 1
    steps:
      - name: Checkout code
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false

      - name: Install rust-code-analysis CLI
        # Pinned + SHA256-verified prebuilt asset → ./bin (same path as local).
        # No Node/pnpm/`make install`: the analyzer reads the source tree directly.
        env:
          RCA_VERSION: '0.0.25'
        run: sh scripts/ci/ensure-rca.sh

      - name: Run code metrics gate
        run: make lint-metrics CI=1
```

### Architectural Boundaries

- **Provisioning boundary:** the binary is installed only by `scripts/ci/ensure-rca.sh` (pinned + verified) into gitignored `./bin`; never an npm dep, never a system path.
- **Enforcement boundary:** `scripts/ci/lint-metrics.sh` is the only place that decides pass/fail; it reads thresholds exclusively from `config/metrics-policy.json`.
- **Execution boundary:** host-only; never `$(PNPM_EXEC)`, the dev container, the `lint` aggregate, `CI_LINT_TARGETS`, or a DinD wrapper.
- **Scope boundary:** `src` ∩ (`*.ts`|`*.tsx`) minus (`*/test/*`, `*.d.ts`, `*/assets/*`, `*/config/*`).
- **Tier boundary:** only `hard` breaches fail CI; `review` is computed and reported, never blocking.
- **CI surface boundary:** the dedicated `rust-code-analysis.yml` (required check `rust-code-analysis`) is the gate's only automated surface.

### Integration Points

- **`config/metrics-policy.json`** — read by the wrapper (thresholds) and validated against `config/metrics-policy.schema.json`.
- **Makefile var block** — single source of scope/excludes/version, shared by local and the workflow.
- **`scripts/ci/ensure-rca.sh`** — shared provisioning path for local `make lint-metrics` and the CI install step.
- **`$GITHUB_STEP_SUMMARY`** — optional Markdown summary sink (null-guarded; absent locally).
- **GitHub branch protection** — `rust-code-analysis` becomes a required status check after ≥1 run.
- **`tests/bats/`** — shell-coverage for the new target via `make test-bats`.

### Data Flow

```text
PR opened/updated -> main
        │
        ▼
rust-code-analysis.yml  (permissions: {} top; contents: read job; CI=1)
        │  checkout(SHA-pinned, no creds) → ensure-rca.sh (pinned + SHA256 verify → ./bin)
        ▼
make lint-metrics CI=1   (host; NO PNPM_EXEC, NO container)
        │  ensure-rca.sh (idempotent) → scripts/ci/lint-metrics.sh
        ▼
validate policy vs schema → rust-code-analysis-cli -m -O json -p src -I *.ts -I *.tsx -X */test/* -X *.d.ts ...
        ▼
NDJSON → jq -rs walks function/closure spaces + file aggregate
        ▼
rows: severity|file|scope|subject|line|metric|value|limit
        ├─ FAIL (hard) ──► collect all ──► report table (+ $GITHUB_STEP_SUMMARY) ──► exit 1 ──► FAILED check
        └─ REVIEW ──────► computed, reported, NEVER fails ──► (if no FAIL) exit 0 ──► PASSED check
```

---

## Architecture Validation Results

### Coherence Validation

- All 7 ADs trace to PRD FRs in their `**Decision:**` lines and to NFRs in the Decision Impact table; the two-tier severities (`hard`/`review`) match the PRD's FR5 classification exactly.
- The five load-bearing divergences from the `lint-deps` playbook (host-only `RCA_BIN`; no `PNPM_EXEC`; out of `lint`/`CI_LINT_TARGETS`; no DinD; parse-and-enforce wrapper) are each recorded as explicit decisions (AD-1, AD-4, AD-5) and documented in-place (AD-7), satisfying NFR10.
- Provisioning, scope, and version live once in the Makefile var block and `config/metrics-policy.json`, applied identically by local and CI (NFR4, NFR9).
- The workflow skeleton mirrors `dependency-cruiser.yml` (PR→main, hardened permissions, SHA-pinned checkout, `persist-credentials: false`, `env: CI: 1`) minus the Node/pnpm steps the analyzer does not need.

### Requirements Coverage Validation

All 33 PRD requirements (FR1–FR21 incl. FR5a–FR5i, NFR1–NFR12) are mapped in the **Requirements to File Mapping** table and the **Decision Impact Analysis**. Spot checks:

- FR1/FR2 → AD-1 (`ensure-rca.sh`, pinned `RCA_VERSION`, SHA256). FR3/FR4/FR5 → AD-2 (policy + schema + tiers). FR5a–FR5i → the `hard`/`review` keys in `config/metrics-policy.json`.
- FR6/FR7/FR8 → AD-3 (`-I *.ts *.tsx`, `-X */test/* *.d.ts */assets/* */config/*`, full-scope). FR9/FR11/FR12 → AD-4 (wrapper, collect-all-then-fail, actionable rows). FR10 → AD-5 (out of aggregate/`CI_LINT_TARGETS`, no DinD).
- FR13–FR17 → AD-6 (job `rust-code-analysis`, install pinned CLI, fail on hard, hardened perms, passing summary). FR18–FR21 → AD-7 (README/CONTRIBUTING/bats).
- NFR1/NFR2 → source-only host run, no build/services. NFR3/NFR4 → pinned version + committed policy. NFR5/NFR6 → exit-code contract + actionable output. NFR7/NFR8 → SHA256/`--locked` + hardened workflow. NFR9/NFR10 → single source of truth + documented divergences. NFR11/NFR12 → baseline calibration + one-command local run.

### Gap Analysis Results

- **Closed gap:** no CI gate measured complexity before; `lint-metrics` now enforces cyclomatic/cognitive/Halstead/MI/LOC/ABC/NARGS/NEXITS/NOM (FR5a–FR5g).
- **No residual functional gap:** every PRD FR maps to a concrete artifact.
- **Forward note (class/interface):** `class_*`/`interface_*` are kept hard but expected inert for TS in v0.0.25; null-safe comparisons guarantee absent values never fire, and the baseline run must confirm whether they emit non-trivial values before they are trusted (FR5h, NFR11).
- **Forward note (thresholds):** the committed `hard` values are CRM-derived placeholders; the baseline-compliance run drives the website's actual numbers (e.g. `mi_visual_studio_min`, `halstead_bugs_file_max`) before the required check is registered.
- **Forward note (`pages/`):** extending coverage beyond `src/` is deferred (PRD Phase 3); `RCA_SCOPE` makes it a one-line change when wanted.

### Architecture Completeness Checklist

- [x] All FR1–FR21 (incl. FR5a–FR5i) mapped to artifacts
- [x] All NFR1–NFR12 addressed by a decision
- [x] Pinned `RCA_VERSION = 0.0.25`, host `RCA_BIN = ./bin/rust-code-analysis-cli`, SHA256 `9ec2a217…9894`, asset `rust-code-analysis-linux-cli-x86_64.tar.gz`
- [x] Complete drop-in `config/metrics-policy.json` (hard{27} + review{32}) embedded
- [x] Complete drop-in `config/metrics-policy.schema.json` embedded
- [x] `scripts/ci/ensure-rca.sh` (pinned + SHA256 verify; cargo fallback) embedded
- [x] `scripts/ci/lint-metrics.sh` parse-and-enforce design embedded (ported from CRM; `-I` include loop; MI fallback; null-safe; collect-all-then-fail)
- [x] Makefile `RCA_*` vars + host-only `lint-metrics` recipe embedded; aggregate & `CI_LINT_TARGETS` explicitly UNCHANGED
- [x] Dedicated `rust-code-analysis.yml` embedded (job `rust-code-analysis`, `permissions: {}` top + `contents: read` job, concurrency, timeout, SHA-pinned checkout, no Node/pnpm)
- [x] Host-only / out-of-aggregate / no-DinD / parse-and-enforce divergences documented (AD-5, AD-7)
- [x] Class/interface inertness for TS flagged for baseline confirmation
- [x] Complete File Change Map ASCII tree provided (ADD/MODIFY/UNCHANGED)
- [x] Requirements-to-File mapping table provided
- [x] Planning-artifacts-only constraint honored (no real files created/edited)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High. The design is grounded in the observed Makefile, `Dockerfile` (no Rust toolchain), `.qlty/qlty.toml`, `.nvmrc`, and `dependency-cruiser.yml`, and it ports a CRM implementation already proven on a TypeScript codebase. The only genuinely repo-specific unknown — the actual threshold numbers and whether class/interface metrics emit values for TS — is explicitly deferred to a baseline-compliance run before the check is made required.

**Key Strengths:**

- Closes the complexity-governance gap with a committed, schema-validated policy and an actionable, collect-all-then-fail gate.
- Faithful CRM parity on policy/script while correctly diverging on execution model (host-only, no Rust container) for the website's reality.
- Self-contained, drop-in artifacts (policy, schema, two scripts, Makefile recipe, workflow) appliable in one PR.
- Hardened, least-privilege workflow with pinned + SHA256-verified provisioning and no network at evaluation time.

**Areas for Future Enhancement:**

- Tighten `hard` thresholds incrementally toward target bands as the codebase improves (Phase 2).
- Promote validated `review` metrics (comment/blank ratios, secondary MI variants) to `hard` (Phase 2).
- Publish the metrics summary as a CI Job Summary / artifact for trend tracking (Phase 2).
- Unify CRM + website policies behind a shared preset; extend coverage to `pages/` (Phase 3).

### Implementation Handoff

A single self-validating PR against `main`: add `config/metrics-policy.json` + `metrics-policy.schema.json`, `scripts/ci/ensure-rca.sh` + `scripts/ci/lint-metrics.sh`, the Makefile `RCA_*` vars + host-only `lint-metrics` target (leaving the `lint` aggregate and `CI_LINT_TARGETS` untouched), `.github/workflows/rust-code-analysis.yml`, `/bin/` to `.gitignore`, the README/CONTRIBUTING sections, and the `tests/bats/make-target-coverage.tsv` row + bats test. Before push, run `make lint-metrics` locally (it auto-provisions the pinned binary) and re-baseline the `hard` thresholds until the run exits `0` on current `main`; confirm whether class/interface metrics emit values. The new workflow then proves itself green on the PR; register `rust-code-analysis` as a required status check after its first run. No `src/` changes, so there is no behavioral risk. Downstream artifacts: `epics-rust-code-analysis-2026-06-25.md` and the per-story implementation files reference the AD-numbers and FR/NFR ids established here.
