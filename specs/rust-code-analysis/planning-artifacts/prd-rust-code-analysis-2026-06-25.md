---
stepsCompleted:
  - step-01-classify-project
  - step-02-define-success-criteria
  - step-03-map-user-journeys
  - step-04-capture-developer-tooling-requirements
  - step-05-scope-phases
  - step-06-enumerate-functional-requirements
  - step-07-build-traceability-matrix
  - step-08-enumerate-non-functional-requirements
inputDocuments:
  - https://github.com/VilnaCRM-Org/website/issues/224
  - Makefile
  - .github/workflows/dependency-cruiser.yml
  - .github/workflows/static-testing.yml
  - .qlty/qlty.toml
  - README.md
  - CONTRIBUTING.md
  - CRM sister-repo config/metrics-policy.json and scripts/lint-metrics.sh (reference pattern)
workflowType: prd
classification:
  projectType: developer-tooling
  domain: code-quality-and-complexity-governance
  complexity: medium
  projectContext: brownfield
status: Draft
---

# Product Requirements Document - Rust Code Analysis

**Author:** BMad **Date:** 2026-06-25 **Source:** [website#224](https://github.com/VilnaCRM-Org/website/issues/224)

## Executive Summary

The VilnaCRM website is a feature-based Next.js / TypeScript application whose code-quality bar is currently held by ESLint, `tsc`, markdownlint, and dependency-cruiser — all of which check correctness, style, and architecture boundaries, but **none of which measure code complexity**. Nothing in CI today rejects a 40-branch function, a deeply nested cognitive-complexity hotspot, an unmaintainable god-file, or a function with an unreasonable argument count. Whether a contribution is "too complex" is decided by reviewer judgement, applied inconsistently, and re-litigated on every pull request. There is no committed, machine-checkable definition of "too complex," and therefore no automatic gate that prevents complexity debt from entering `main`.

This PRD specifies the introduction of **Mozilla `rust-code-analysis`** as a first-class, CI-enforced code-complexity quality gate for the website repository. `rust-code-analysis-cli` is a language-agnostic, tree-sitter-based static-analysis binary that emits per-file and per-function metrics — cyclomatic complexity, cognitive complexity, the Halstead suite, Maintainability Index, size/LOC families, ABC, NARGS, NEXITS, NOM, and class/interface metrics — for the repository's `src/` TypeScript and TSX sources. We pin the CLI to a single source-of-truth version (`RCA_VERSION = 0.0.25`), provision it as a host-installed Rust binary, commit an in-repo thresholds policy that defines what counts as a violation, wire a `make lint-metrics` target that runs the analyzer and fails past any hard threshold, add a dedicated `.github/workflows/rust-code-analysis.yml` workflow that auto-runs on every pull request to `main`, and document local usage in the README and CONTRIBUTING.

The policy defines **two classes of thresholds**: **hard thresholds** (blocking — cyclomatic, cognitive, Halstead volume/bugs, size/LOC, ABC, NARGS, NEXITS, NOM, Maintainability Index floor, plus forward-compatible class/interface bounds) whose breach fails the build, and **review thresholds** (non-blocking — the remaining Halstead submetrics, comment/blank ratios, and the secondary MI variants) that are computed and tracked for calibration but never fail CI. The gate is **collect-all-then-fail**: a failing run reports every hard violation — naming the file, the function or scope, the metric, the measured value, and the breached threshold — before exiting non-zero, so a contributor can remediate in one pass instead of iterating one error at a time. This is requirements-level scope only; the concrete policy values, the enforcement-script design, the Dockerfile/host-install mechanics, and the exact CLI invocation belong to the architecture document `architecture-rust-code-analysis-2026-06-25.md`.

### What Makes This Special

Two characteristics distinguish this work from the repository's other CI gates and from a naive port of the CRM sister-repo tooling. First, `rust-code-analysis` is a **standalone Rust binary, not an npm package** under `node_modules/.bin` — so unlike `eslint`, `tsc`, or `depcruise` it cannot run through the repo's `PNPM_EXEC` dev-container wrapper (the `node:23.x-alpine` dev image ships no Rust toolchain). The gate therefore runs **host-only** in both local and CI modes, stays **out of** the `lint` aggregate and `CI_LINT_TARGETS`, ships **no DinD wrapper**, and provisions the binary via a pinned `cargo install` / release-tarball step rather than `make install`. Second, `rust-code-analysis-cli` **only emits metrics — it never exits non-zero on a threshold** the way `depcruise` does; to be a gate at all, the metrics output must be parsed against the committed policy by a thin wrapper script that decides pass/fail. These two facts — host-only provisioning and a parse-and-enforce wrapper — are the load-bearing deviations from the dependency-cruiser playbook and are called out explicitly throughout this document.

## Project Classification

| Attribute | Value |
| --- | --- |
| Project type | Developer tooling / CI quality gate |
| Domain | Code-quality & complexity governance (static metrics analysis of the TypeScript source tree) |
| Complexity | Medium — a committed thresholds policy plus a parse-and-enforce wrapper, Makefile, and CI wiring; complexity is in calibrating thresholds and authoring the enforcement script, not in volume of code |
| Project context | Brownfield — established Next.js feature-based TS codebase with existing Makefile-driven CI (ESLint, tsc, markdownlint, dependency-cruiser) |
| Primary users | Repository contributors (developers), code reviewers, CI maintainers |
| Risk profile | Low blast radius — additive tooling only; no `src/` changes; thresholds are baseline-calibrated so the gate starts green |

## Success Criteria

### User Success

- A developer can run a single command (`make lint-metrics`) locally and receive a clear pass/fail complexity report — naming any offending file, function, metric, measured value, and breached threshold — before opening a pull request.
- When a developer introduces an over-complex function or an unmaintainable file (cyclomatic or cognitive complexity, Halstead, size/LOC, or Maintainability Index past policy), they get an actionable, human-readable error they can act on without interpreting the raw analyzer output.
- A reviewer no longer has to eyeball diffs for "this function is doing too much"; the CI gate evaluates complexity deterministically against a committed, agreed-upon policy.

### Business Success

- Code-complexity enforcement moves from per-reviewer discretion to **committed repository policy**, so "too complex" is defined once, in-repo, and applied uniformly to every pull request.
- The website repository gains a complexity-governance guarantee comparable to the CRM sister repo, bringing the two repositories toward tooling parity and lowering the cost of context-switching for engineers who work across both.

### Technical Success

- The complexity gap is closed: cyclomatic, cognitive, Halstead, size, and Maintainability-Index thresholds are enforced where no metric gate previously existed.
- The check runs automatically on every pull request to `main` and fails the build on any hard-threshold violation, while review-tier metrics are tracked without blocking.
- The thresholds and the analysis scope live in committed, in-repo configuration that is the single source of truth applied identically by the local `make lint-metrics` target and the CI workflow.

### Measurable Outcomes

- **Coverage:** 100% of in-scope `src/` `*.ts` and `*.tsx` modules (excluding `src/test`, `*.d.ts`, `assets`, `config`, and build outputs) are analyzed on every PR to `main`.
- **Baseline:** thresholds are calibrated to the current `main` so the gate reports **zero hard violations** on introduction (green on day one), with class/interface metrics confirmed during the baseline run.
- **Determinism:** the same commit, policy, and pinned CLI version produce the same pass/fail result on every run — no flakiness, no network dependence at analysis time.
- **Performance:** a full metrics analysis of `src/` completes well within the existing static-testing budget — it requires no application build, no `node_modules`, and no running services.
- **Security:** the host binary is provisioned reproducibly from a pinned version with a verified artifact (SHA256-checked release tarball or `--locked` `cargo install`), so an unexpected or tampered binary cannot enter the build.
- **Enforcement:** a pull request that breaches any hard threshold is **blocked** (non-zero exit, failed check); review-tier breaches surface without failing the build.

## User Journeys

### Journey 1: The contributor who writes an over-complex function

**Persona:** Maria, a mid-level frontend engineer adding a multi-step form handler to the `registration` feature.

**Opening Scene:** Maria writes a single `handleSubmit` function that validates every field inline, branches on each error case, and threads a dozen conditionals through one body. It compiles, the unit tests pass, and ESLint is silent — none of the existing linters measure how branchy or cognitively dense the function is.

**Rising Action:** Maria assumes "tests green, lint green" means she is done and opens a PR against `main`.

**Climax:** The `rust-code-analysis` CI workflow runs automatically. It fails with named hard violations: the function's **cyclomatic complexity** and **cognitive complexity** both exceed policy, and its **NEXITS** (exit-point count) is over the limit. The output names the exact file, the function `handleSubmit`, its start line, each breached metric, the measured value, and the threshold — all in one report.

**Resolution:** Maria reads the report, extracts the validation branches into small helpers and a lookup map, re-runs `make lint-metrics` locally until it passes, and pushes a clean commit. The required check goes green and the PR is mergeable — without a reviewer having to argue the function was "too complex."

**Reveals requirements for:** the cyclomatic and cognitive hard thresholds (FR5a, FR5b), the structural NEXITS threshold (FR5f), the local `make lint-metrics` target (FR9), collect-all-then-fail reporting (FR11), actionable violation output (FR12), and the CI gate that auto-runs and fails on violations (FR13, FR15).

---

### Journey 2: The contributor whose file becomes unmaintainable

**Persona:** Dmytro, a senior engineer growing a shared utility module in the `landing` feature.

**Opening Scene:** Over a few commits Dmytro keeps appending helpers to one `utils.ts` file. It now holds many functions, long bodies, and dense expressions. Everything still type-checks and the architecture-boundary rules are satisfied — dependency-cruiser has nothing to say about a single file's internal complexity.

**Rising Action:** Locally nothing warns him; the file is "just big." He opens a PR.

**Climax:** On PR, the gate fails on **file-scope** hard thresholds: the file's **Maintainability Index** (`mi_visual_studio`) has dropped below the policy floor, its **size/LOC** (logical and source lines) exceed the per-file maxima, and its **NOM** (number of methods/functions in the file) is over the cap. The passing portions of the run still report their measured values so Dmytro can see how far over he is.

**Resolution:** Dmytro splits the module into cohesive files, simplifies the densest expressions, and the Maintainability Index recovers above the floor. The build goes green, and the previously invisible "this file is degrading" signal is now enforced for everyone.

**Reveals requirements for:** the Maintainability-Index floor and size/LOC thresholds (FR5c, FR5e), the NOM file-level thresholds (FR5g), the MI legacy-field fallback (FR5c), the passing-run metric summary (FR17), CI enforcement (FR13, FR15), and determinism across local and CI (NFR3, NFR4).

---

### Journey 3: The contributor who must raise a budget intentionally

**Persona:** Olena, adding a genuinely irreducible state-machine reducer to the `swagger` feature.

**Opening Scene:** Olena's reducer is a large `switch` whose branch count legitimately exceeds the cyclomatic threshold — the complexity is inherent to the domain, not accidental, and splitting it would obscure rather than clarify.

**Rising Action:** The gate fails on her PR. Her first instinct is to silence the analyzer wholesale, but the documentation steers her elsewhere: thresholds are not disabled per-line; they are governed by the committed policy, and a deliberate budget change is a reviewed, in-repo decision.

**Climax:** Following the README's "raising a budget" guidance, Olena proposes a small, justified threshold adjustment in the committed policy file (or confirms the file legitimately belongs outside the governed scope, e.g. it is generated or under an excluded path). Because the policy is a single committed source of truth, the change is visible in the diff, reviewed, and applied identically to local and CI.

**Resolution:** The reviewers agree the reducer is irreducible, the budget change merges with the feature, and the gate is green — but the exception is explicit, reviewed, and documented rather than a silent local override.

**Reveals requirements for:** the committed single-source-of-truth policy (FR3), the hard/review two-tier classification (FR5), the governed-scope/exclusion definition (FR7), the documented "how to raise a budget / grant an exception" guidance (FR21), and consistency of policy across local and CI (NFR9).

---

### Journey 4: The CI maintainer wiring a host-only, parse-and-enforce gate

**Persona:** Pavlo, who maintains CI across both the CRM and website repositories.

**Opening Scene:** CRM already enforces `rust-code-analysis` via a committed `config/metrics-policy.json`, a `lint-metrics` make target, and a dedicated workflow. The website has the target name reserved but not yet ported. Pavlo needs to bring it up — but the website's conventions differ from a normal npm-tool gate.

**Rising Action:** Pavlo confirms the binary is **not** an npm dependency, so the dev-container `PNPM_EXEC` path cannot run it; the gate must run host-only and stay out of the `lint` aggregate and `CI_LINT_TARGETS`, with no DinD wrapper. He also confirms that `rust-code-analysis-cli` only emits JSON metrics and never self-fails, so the gate needs a wrapper script that parses the emitted metrics against the committed policy and exits non-zero. He provisions the CLI in CI from the pinned `RCA_VERSION` with a verified artifact.

**Climax:** With the policy file, the enforcement wrapper, the `make lint-metrics` target, and the dedicated `.github/workflows/rust-code-analysis.yml` in place, Pavlo verifies the workflow triggers on `pull_request -> branches:[main]`, runs with `permissions: contents: read`, sets `env: CI: 1`, checks out with a SHA-pinned action and `persist-credentials: false`, installs the pinned CLI, and runs `make lint-metrics CI=1`. He runs the gate against current `main` and confirms it is green (baseline-calibrated), then registers the check.

**Resolution:** Both repos now enforce complexity the same way, modulo the website's host-only / parse-and-enforce adaptations, which Pavlo documents as deliberate, reviewed decisions alongside the existing "intentionally not ported" notes in the Makefile.

**Reveals requirements for:** the pinned host-binary provisioning (FR1, FR2), the host-only target that stays out of the aggregate with no DinD wrapper (FR9, FR10), the parse-and-enforce wrapper (FR9, FR11), the dedicated hardened workflow with the pinned CLI install (FR13, FR14, FR16), the baseline-green calibration (NFR11), and the secure-provisioning requirement (NFR7).

---

### Journey Requirements Summary

| Journey | Primary requirements surfaced |
| --- | --- |
| 1 — Over-complex function | FR5a, FR5b, FR5f, FR9, FR11, FR12, FR13, FR15 |
| 2 — Unmaintainable file | FR5c, FR5e, FR5g, FR13, FR15, FR17, NFR3, NFR4 |
| 3 — Intentional budget raise | FR3, FR5, FR7, FR21, NFR9 |
| 4 — Host-only parse-and-enforce gate | FR1, FR2, FR9, FR10, FR11, FR13, FR14, FR16, NFR7, NFR11 |

## Developer Tooling Requirements

### Tooling & Binary Provisioning

The toolchain adds `rust-code-analysis-cli` pinned to a single source-of-truth version (`RCA_VERSION = 0.0.25`). Because the analyzer is a standalone Rust binary rather than an npm package, it is **not** installed under `node_modules/.bin` and is **not** acquired via `make install`. It is provisioned as a host-resolved binary — either by `cargo install rust-code-analysis-cli --version "$RCA_VERSION" --locked` or by downloading the pinned GitHub release tarball `rust-code-analysis-linux-cli-x86_64.tar.gz` and verifying its SHA256 (`9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894`) before use. The Makefile declares `RCA_VERSION` and `RCA_BIN` (a PATH-resolved binary, with a clarifying comment that it is intentionally not a `$(BIN_DIR)/...` entry), keeping provisioning reproducible and the version a single source of truth shared by local and CI.

### Metrics Policy & Thresholds

All thresholds live in a committed, in-repo policy file that is the single source of truth applied identically by the local target and the CI gate, validated against a committed JSON Schema before enforcement. Each metric is classified as either a **hard** threshold (blocking, fails the build) or a **review** threshold (non-blocking, computed and tracked for calibration). Hard thresholds cover the meaningful TypeScript complexity surface: cyclomatic complexity, cognitive complexity, Halstead volume and Halstead bugs (function and file), size/LOC (logical, physical, source lines at function and file scope), ABC magnitude, NARGS (function and closure argument counts), NEXITS, NOM (functions, closures, total per file), and a Maintainability-Index floor (`mi_visual_studio`). Class and interface metrics are bounded as hard thresholds for forward-compatibility even though they are largely inert for TypeScript in v0.0.25. Review thresholds cover the remaining Halstead submetrics, the secondary MI variants (`mi_original`, `mi_sei`), and the comment/blank-ratio band checks.

### Analysis Scope

The analyzer targets the `src/` TypeScript source tree restricted to `*.ts` and `*.tsx` files. `*.js`/`*.jsx` are skipped (the only production `.js` is `src/config/i18nConfig.js`, and `config/` is already an established exclusion). The governed scope excludes non-production and unsupported assets — `src/test`, `*.d.ts` (e.g. `src/react-app-env.d.ts`), `assets`, `config`, `node_modules`, build outputs (`out/`, `.next/`), and `specs/**` — mirroring the precedent in `.qlty/qlty.toml`. The full governed scope is evaluated on every run; there is no changed-files-only mode.

### Local Developer Workflow

A `make lint-metrics` target runs the analyzer on the **host** (never through `PNPM_EXEC` / the dev container, which has no Rust binary), emits metrics as JSON, and pipes them through a thin enforcement wrapper under `scripts/ci/` that parses the metrics against the committed policy and exits non-zero past any hard threshold. The target carries a trailing `## ` help description so it appears in `make help`. Critically, `lint-metrics` does **not** join the `lint` aggregate or `CI_LINT_TARGETS` (both route through the dev container) and ships **no DinD wrapper**; its only CI surface is its own dedicated workflow. The wrapper is collect-all-then-fail and produces actionable output identifying file, function/scope, metric, value, and threshold.

### CI Enforcement

A dedicated `.github/workflows/rust-code-analysis.yml` workflow triggers on `pull_request -> branches:[main]`, declares least-privilege `permissions: contents: read`, sets `env: CI: 1`, checks out with a SHA-pinned action and `persist-credentials: false`, installs the pinned CLI (no Node/pnpm/`make install` steps — the analyzer reads files directly), and runs `make lint-metrics CI=1`. The job name is `rust-code-analysis`. The workflow fails the build on any hard-threshold violation; a passing run reports the measured metric values.

### Documentation

The README gains a "Code Metrics (rust-code-analysis)" section — modeled on the existing "Architecture Rules (dependency-cruiser)" section — listing what is enforced, the hard/review threshold sets, how to run it locally, and how to raise a budget or grant an exception. CONTRIBUTING gains a "Code metrics (rust-code-analysis)" subsection, and the new target is recorded in `tests/bats/make-target-coverage.tsv` so Makefile shell coverage stays complete.

## Project Scoping & Phased Development

### MVP Strategy

The MVP is the complete, working, CI-enforced complexity gate as described in the issue's acceptance criteria. Because this is additive developer tooling with a low blast radius and thresholds calibrated to a clean baseline, the entire deliverable fits comfortably in a single phase — a policy without CI enforcement provides no guarantee, and CI enforcement without a local command frustrates contributors. The MVP therefore delivers binary provisioning + policy + enforcement wrapper + local target + CI workflow + docs together.

### MVP Feature Set (Phase 1)

1. `rust-code-analysis-cli` pinned to `RCA_VERSION = 0.0.25`, provisioned as a host binary with a verified artifact (SHA256-checked tarball or `--locked` cargo install).
2. A committed thresholds policy (and its JSON Schema) defining hard and review thresholds for the full metric surface, baseline-calibrated to current `main`.
3. A `make lint-metrics` host-only target plus its `scripts/ci/` parse-and-enforce wrapper (collect-all-then-fail), kept out of the `lint` aggregate and `CI_LINT_TARGETS`, with no DinD wrapper.
4. A dedicated `.github/workflows/rust-code-analysis.yml` that auto-runs on PRs to `main`, installs the pinned CLI, and fails on hard violations.
5. README "Code Metrics (rust-code-analysis)" section and a CONTRIBUTING subsection, plus the `tests/bats/make-target-coverage.tsv` update.

### Critical Scoping Decisions

- **Host-only execution; no dev-container path.** Because the analyzer is a Rust binary absent from the `node:23.x-alpine` dev image, `lint-metrics` runs on the host in both local and CI modes and deliberately does **not** use `PNPM_EXEC`. This is the central divergence from how npm-tool gates (`eslint`, `tsc`, `depcruise`) are wired and must be documented.
- **Out of the `lint` aggregate and `CI_LINT_TARGETS`; no DinD wrapper.** Adding `lint-metrics` to `make lint` or the parallel `ci-lint` runner would require the Rust binary inside the dev container, which it is not. The gate's only CI surface is its dedicated workflow. The omission is deliberate and documented, mirroring the Makefile's existing "intentionally not ported" notes.
- **Parse-and-enforce wrapper is required.** `rust-code-analysis-cli` emits metrics but never exits non-zero on a threshold, so a thin `scripts/ci/` wrapper that parses the JSON against the committed policy and exits non-zero is the one place this gate cannot be a 1:1 copy of `lint-deps`.
- **Two-tier thresholds with a baseline-green start.** Hard thresholds block; review thresholds inform. Threshold values are calibrated to the current `main` distribution so the gate is green on introduction, then tightened over time — class/interface metrics are confirmed (and may prove inert for TS) during the baseline run.
- **Target `*.ts`/`*.tsx` only; exclude `src/test`.** `*.js`/`*.jsx` are skipped (sole production `.js` is an excluded config file) and test code is exempt, mirroring `.qlty/qlty.toml`.

### Delivery Strategy

Ship as one PR against `main`. The PR is self-validating: the new CI workflow runs against the PR itself and must pass (thresholds are baseline-calibrated), demonstrating the gate is green on introduction. Because no `src/` files change, there is no behavioral risk to the application.

### Post-MVP Features (Phase 2)

- Tighten hard thresholds incrementally from the loose baseline toward target quality bands as the codebase improves.
- Promote selected review-tier metrics (e.g. comment/blank ratios, secondary MI variants) to hard once their distributions are validated against the codebase.
- Publish the metrics summary as a CI Job Summary / artifact for trend tracking across PRs.

### Vision (Phase 3)

- Unify the CRM and website metrics policies behind a shared preset where the thresholds overlap.
- Track per-file metric trends over time to flag gradual degradation before it crosses a threshold.
- Extend coverage to additional roots (e.g. `pages/`) once the `src/` gate has proven stable and useful.

### Risk Mitigation

- **Risk: thresholds fail too broadly on day one.** Mitigated by calibrating hard thresholds to the current `main` baseline (green on introduction) and keeping uncertain metrics in the non-blocking review tier until validated.
- **Risk: the binary is unavailable or untrusted on the runner.** Mitigated by pinning `RCA_VERSION`, verifying the release-tarball SHA256 (or using `--locked` cargo install), and provisioning host-side so no dev-container Rust toolchain is needed.
- **Risk: contributors are confused that the gate is missing from `make lint`.** Mitigated by documenting the deliberate host-only / out-of-aggregate decisions in the README, CONTRIBUTING, and Makefile notes, and by exposing the target through `make help`.
- **Risk: class/interface metrics emit nothing for TS and create dead policy.** Mitigated by confirming their values during the baseline run and keeping them bounded-but-permissive (forward-compat) rather than relied upon.
- **Risk: drift between local and CI results.** Mitigated by a single committed policy + pinned CLI version applied identically in both, evaluated over the same governed scope.

## Functional Requirements

### Tooling & Binary Provisioning

- FR1: The repository can pin `rust-code-analysis-cli` to a single source-of-truth version (`RCA_VERSION = 0.0.25`) declared in the Makefile, and reference it as a host-resolved binary (`RCA_BIN`) rather than an npm devDependency under `$(BIN_DIR)/...`.
- FR2: The toolchain can provision the pinned CLI deterministically and securely — either `cargo install rust-code-analysis-cli --version "$RCA_VERSION" --locked`, or downloading the pinned release tarball `rust-code-analysis-linux-cli-x86_64.tar.gz` and verifying its SHA256 (`9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894`) before execution.

### Metrics Policy & Thresholds

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

### Analysis Scope

- FR6: The analyzer can target the `src/` TypeScript source tree restricted to `*.ts` and `*.tsx` files, skipping `*.js`/`*.jsx` (the sole production `.js` being an already-excluded config file).
- FR7: The governed scope can exclude non-production and unsupported assets — `src/test`, `*.d.ts`, `assets`, `config`, `node_modules`, build outputs (`out/`, `.next/`), and `specs/**` — consistent with the existing `.qlty/qlty.toml` exclusion precedent.
- FR8: The gate can evaluate the full governed scope on every run, with no changed-files-only / incremental mode, so coverage is uniform across pull requests.

### Local Developer Workflow

- FR9: A `make lint-metrics` target can run the analyzer on the **host** (never via `PNPM_EXEC` / the dev container), emit metrics as JSON, and pass them through a `scripts/ci/` enforcement wrapper that parses the metrics against the committed policy and exits non-zero past any hard threshold — because `rust-code-analysis-cli` itself only emits metrics and never self-fails. **This host-only, parse-and-enforce design is a deliberate deviation from the npm-tool gate pattern and must be documented.**
- FR10: The `lint-metrics` target can be kept **out** of both the `lint` aggregate (`lint: lint-next lint-tsc lint-md lint-deps`) and `CI_LINT_TARGETS`, and can ship **no** DinD wrapper, because the host-only Rust binary is absent from the dev container; its only CI surface is the dedicated workflow, and `make help` can list it via its trailing `## ` description. **This omission is deliberate and must be documented like the Makefile's existing "intentionally not ported" notes.**
- FR11: The enforcement wrapper can report **all** hard violations before exiting (collect-all-then-fail), never fail-fast, so a contributor can remediate every breach in a single pass.
- FR12: From a failed run, a developer can identify the offending **file**, **function/scope** (with start line), **metric**, **measured value**, and **breached threshold** directly from the output, without consulting the raw analyzer JSON.

### CI Enforcement

- FR13: A dedicated `.github/workflows/rust-code-analysis.yml` workflow can run the metrics gate automatically on every `pull_request` targeting `branches: [main]`, with the job named `rust-code-analysis`.
- FR14: The CI workflow can install the pinned `rust-code-analysis-cli` (matching `RCA_VERSION`) before running the gate, omitting the Node/pnpm/`make install` steps that other workflows use, since the analyzer reads the source tree directly.
- FR15: The CI workflow can fail the pull request (non-zero exit / failed required check) whenever any **hard**-threshold violation is detected, while review-tier breaches surface without failing the build.
- FR16: The CI workflow can declare least-privilege `permissions: contents: read`, set `env: CI: 1`, and check out the repository with a SHA-pinned action and `persist-credentials: false`.
- FR17: A passing run can report the measured metric values / summary in the CI job output, so successful runs are informative and not merely silent.

### Documentation

- FR18: The README can include a "Code Metrics (rust-code-analysis)" section — modeled on the existing "Architecture Rules (dependency-cruiser)" section — that lists what is enforced, the hard and review threshold sets, and links the dedicated workflow.
- FR19: The CONTRIBUTING guide can include a "Code metrics (rust-code-analysis)" subsection describing when the gate runs and where budgets live, and the new target can be recorded in `tests/bats/make-target-coverage.tsv` so Makefile shell coverage stays complete.
- FR20: The documentation can describe `make lint-metrics` as the single local command (including host-binary install) and explain how to interpret failure output and passing summaries without raw-tool interpretation.
- FR21: The documentation can explain how to **raise a budget / grant an exception** by adjusting the committed policy (a reviewed, in-repo change) or confirming a path belongs outside the governed scope, rather than silently disabling the gate.

## Traceability Matrix

| FR | Epic | Stories | Coverage |
| --- | --- | --- | --- |
| FR1 | Epic 1: Tooling & Binary Provisioning | 1.1 | pin RCA_VERSION; host-resolved RCA_BIN |
| FR2 | Epic 1: Tooling & Binary Provisioning | 1.1 | deterministic, SHA256-verified provisioning |
| FR3 | Epic 2: Metrics Policy & Thresholds | 2.1 | committed single-source-of-truth policy file |
| FR4 | Epic 2: Metrics Policy & Thresholds | 2.1 | JSON Schema validation of policy |
| FR5 | Epic 2: Metrics Policy & Thresholds | 2.1 | hard vs review two-tier classification |
| FR5a | Epic 2: Metrics Policy & Thresholds | 2.2 | cyclomatic complexity hard max |
| FR5b | Epic 2: Metrics Policy & Thresholds | 2.2 | cognitive complexity hard max |
| FR5c | Epic 2: Metrics Policy & Thresholds | 2.2 | MI floor (mi_visual_studio) + legacy fallback |
| FR5d | Epic 2: Metrics Policy & Thresholds | 2.2 | Halstead volume/bugs hard; submetrics review |
| FR5e | Epic 2: Metrics Policy & Thresholds | 2.2 | size/LOC (lloc/ploc/sloc) function & file |
| FR5f | Epic 2: Metrics Policy & Thresholds | 2.2 | ABC, NARGS, NEXITS structural hard maxima |
| FR5g | Epic 2: Metrics Policy & Thresholds | 2.2 | NOM functions/closures/total per file |
| FR5h | Epic 2: Metrics Policy & Thresholds | 2.2 | class/interface bounds (forward-compat) |
| FR5i | Epic 2: Metrics Policy & Thresholds | 2.2 | comment/blank ratio band checks (review) |
| FR6 | Epic 3: Analysis Scope | 3.1 | src/ *.ts/*.tsx only; skip *.js/*.jsx |
| FR7 | Epic 3: Analysis Scope | 3.1 | exclusions per .qlty precedent |
| FR8 | Epic 3: Analysis Scope | 3.1 | full-scope evaluation each run |
| FR9 | Epic 4: Local Developer Workflow | 4.1 | host-only make lint-metrics + enforce wrapper |
| FR10 | Epic 4: Local Developer Workflow | 4.1 | out of lint aggregate/CI_LINT_TARGETS; no DinD |
| FR11 | Epic 4: Local Developer Workflow | 4.2 | collect-all-then-fail |
| FR12 | Epic 4: Local Developer Workflow | 4.2 | actionable file/function/metric/value/threshold |
| FR13 | Epic 5: CI Enforcement | 5.1 | dedicated workflow auto-runs on PR->main |
| FR14 | Epic 5: CI Enforcement | 5.1 | install pinned CLI in CI |
| FR15 | Epic 5: CI Enforcement | 5.1 | fail on hard violations |
| FR16 | Epic 5: CI Enforcement | 5.2 | hardened permissions + pinned checkout + CI:1 |
| FR17 | Epic 5: CI Enforcement | 5.2 | passing-run metric summary |
| FR18 | Epic 6: Documentation | 6.1 | README metrics section |
| FR19 | Epic 6: Documentation | 6.2 | CONTRIBUTING subsection + bats coverage tsv |
| FR20 | Epic 6: Documentation | 6.1 | local usage + failure/summary interpretation |
| FR21 | Epic 6: Documentation | 6.2 | how to raise a budget / grant an exception |

## Non-Functional Requirements

### Performance

- NFR1: A full metrics analysis of the governed `src/` scope must complete within the existing static-testing time budget — comparable to the other static linters — requiring no application build, no `node_modules`, and no running services.
- NFR2: The analysis must operate on the source tree only (no compilation, no dev container, no service startup), keeping the CI job lightweight and host-runnable.

### Reliability

- NFR3: The check must be deterministic: the same commit, policy, and pinned CLI version produce the same pass/fail result on every run, with no flakiness.
- NFR4: Metric computation must be reproducible across local and CI environments given identical source, committed policy, and pinned `RCA_VERSION`.

### Failure Behavior

- NFR5: Any **hard**-threshold violation must cause a non-zero exit code and a failed CI check; **review**-threshold breaches must surface (or be tracked) without failing the build.
- NFR6: Violation output must be actionable — naming the file, function/scope, metric, measured value, and breached threshold — so failures are self-explanatory in the CI log without raw-tool interpretation.

### Security

- NFR7: The host binary must be provisioned reproducibly and securely — a pinned `RCA_VERSION` plus a SHA256-verified release tarball or a `--locked` `cargo install` — so an unexpected, mismatched, or tampered artifact cannot enter the build, and analysis must require no network access at evaluation time.
- NFR8: The CI workflow must run with least privilege (`permissions: contents: read`), a SHA-pinned checkout action, and `persist-credentials: false`.

### Consistency

- NFR9: The thresholds and the governed-scope definition must live in committed, in-repo configuration that is the single source of truth applied identically by the local target and CI; any README mirror of the thresholds must be flagged as "must be kept in sync" with the policy file.
- NFR10: The gate must follow the website's existing conventions (Makefile variable-block style, `## ` help comments, the dependency-cruiser workflow skeleton) while explicitly documenting its deliberate divergences — host-only execution, exclusion from the `lint` aggregate and `CI_LINT_TARGETS`, no DinD wrapper, and a parse-and-enforce wrapper instead of a self-failing CLI.

### Compatibility

- NFR11: Thresholds must be baseline-calibrated to the website's current `src/` distribution so the gate reports **zero hard violations** on introduction (green on day one), and the inert-for-TS class/interface metrics must be confirmed during the baseline run rather than assumed.
- NFR12: A contributor must be able to run the identical gate locally with one command (`make lint-metrics`) before pushing, on a host with the pinned CLI provisioned, and obtain the same hard/review result the CI gate would produce.
