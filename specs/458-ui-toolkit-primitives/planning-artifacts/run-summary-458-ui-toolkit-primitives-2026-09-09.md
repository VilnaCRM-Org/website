# Run Summary — 458 ui-toolkit primitives

**Bundle directory:** `specs/458-ui-toolkit-primitives/planning-artifacts/`
**Source:** [website#458](https://github.com/VilnaCRM-Org/website/issues/458) (OPEN), realised by
[PR #459](https://github.com/VilnaCRM-Org/website/pull/459) (`feat/ui-toolkit-dependency`, OPEN,
review state CHANGES_REQUESTED at planning time).
**Mode:** retrospective — the planning chain was authored against an existing PR, so the
artifacts describe the requirements and design the PR realises and record where the PR still
falls short of them.

## Task Framing

Render the shared `Ui*` primitives from `@vilnacrm/ui-toolkit` (v0.3.0 release tarball)
instead of a second local copy, keeping each `src/components/ui-*` path as an import seam,
keeping the primitives whose toolkit version would regress shipped a11y/security behaviour
as thin local adapters, re-wiring fonts so the toolkit's bare `Inter` / `Golos Text`
references resolve, and teaching Jest to resolve the ESM-only package — with no gate,
baseline or threshold relaxed.

> Assumption: the profile validator (`validate-profile.sh`) reports the Lighthouse floors
> (85 desktop / 40 mobile) as "lowered below shipped default". Those values are the
> repository's deliberate, evidence-based floors for a client-side-rendered landing (see the
> profile and `lighthouserc*`), not a relaxation made for this change; the chain proceeds
> and restates them as raise-only floors.

> Assumption: artifact file names follow the committed `specs/README.md` convention
> (`<type>-<spec-name>-<date>.md` under `planning-artifacts/`) rather than the plugin's flat
> `research.md`… names, so the bundle matches the two existing specs in this repository.

## Subagent Execution Log

| Phase | BMAD command | Artifact | Model / effort | Validation rounds |
| --- | --- | --- | --- | --- |
| Research | `analyst` | `research-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort (Fable run hit the session limit) | 1 (accepted) |
| Brief | `create-brief` | `brief-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort | 1 (accepted) |
| PRD | `create-prd` | `prd-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort | 1 (accepted) |
| Architecture | `create-architecture` | `architecture-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort | 1 (accepted) |
| Epics & stories | `create-epics-stories` | `epics-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort | 1 (accepted) |
| Readiness (iteration 1) | `implementation-readiness` | `readiness-458-ui-toolkit-primitives-2026-09-09.md` | Opus, high effort | verdict FAIL — 1 blocking, 4 major, 10 minor |
| Correction pass | — | `prd-`, `architecture-`, `epics-` (surgical edits) | Opus, high effort | all findings addressed |
| Readiness (iteration 2) | `implementation-readiness` | `readiness-458-ui-toolkit-primitives-2026-09-09.md` (overwritten) | Opus, high effort | verdict **PASS** — 0 blocking; 1 new major and 1 minor closed post-review |

## Correction Loop

Iteration 1 of a bounded `MAX_ITERATIONS=5` loop returned FAIL on a single blocking finding:
the coverage layer for the plan's new supply-chain verifier was stated three different ways
across the architecture and epics, and the acceptance criterion carrying it could not fail.
The correction pass resolved it to the client Jest layer with a path-keyed coverage group,
closed the four major findings (adapter count, the upstream entry-point gap and the
fallback branch's exit for the last two epics, a same-file story dependency, and a
requirement with no architecture home) and every minor finding. The brief's adapter-count
wording was reconciled separately. Iteration 2 re-validates those corrections.

Iteration 2 returned **PASS**. It raised one new major finding — the B1 fix had given Story
1.2 a file Story 2.1 already owned, without declaring the dependency — plus four minor ones.
The dispatch-breaking finding and the one minor sharing its cause were closed immediately
after the review; three advisory minors are left open and named in the report.

## Open Questions and Warnings

- The static-JS budget is over by 36,275 bytes and the plan forbids raising it. If the
  bundle-analyzer diff cannot recover those bytes, the plan's own fallback suspends the
  visual-baseline epic, files the upstream per-component entry-point request, and returns
  PR #459 to draft rather than shipping.
- The font fallback-metric recompute rule is a documented procedure, not a gate. It is the
  weakest verification link in the design and is recorded as an accepted residual risk.
- `osv-scanner` structurally cannot key a remote-tarball dependency, so the committed
  SHA-256 digest and its `lint-ui-toolkit` gate are the only integrity signal this
  dependency has.

## Status

Chain complete: all six artifacts written, readiness **PASS** on iteration 2 of a maximum
of 5.

## Recommended Next Step

Work the epics in the order the dependency graph gives, starting with the four Layer-0
stories. The first fix that turns a red check green is the client-layer CSSOM rewrite of the
checkbox hover-token assertion; the byte budget is measured only over a tree that already
tests clean.
