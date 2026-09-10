---
verdict: PASS
iteration: 2
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
inputDocuments:
  - ./research-458-ui-toolkit-primitives-2026-09-09.md
  - ./brief-458-ui-toolkit-primitives-2026-09-09.md
  - ./prd-458-ui-toolkit-primitives-2026-09-09.md
  - ./architecture-458-ui-toolkit-primitives-2026-09-09.md
  - ./epics-458-ui-toolkit-primitives-2026-09-09.md
  - ./run-summary-458-ui-toolkit-primitives-2026-09-09.md
  - readiness iteration 1 (this file, overwritten)
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - jest.config.ts, Makefile, src/test/unit/contracts/check-api-versions.test.ts (repo state, read-only)
  - node_modules/@jest/reporters/build/index.js (jest 30.4.2 threshold implementation, read-only)
workflowType: implementation-readiness
status: Final
---

# Implementation Readiness Assessment - `@vilnacrm/ui-toolkit` (#458) - Iteration 2

**Date:** 2026-09-09 **Project:** website **Assessor:** BMad Architect (Winston), Validate mode

## Verdict

**PASS** - blocking finding B1 is closed and verified against repository evidence; all four
major findings are closed; all ten minor findings are closed. One **new major** finding (N1)
and four new minor findings are recorded with correction paths; none of them breaks
traceability, contradicts an implementer-facing statement, or touches gate integrity, so none
gates the verdict.

The B1 correction is not merely restated - the mechanism it chose was checked against the
runner that has to enforce it, and it fails closed in both directions. N1 is the one blemish:
the correction added `jest.config.ts` to Story 1.2's file list without noticing Story 2.1
already owns that file, reintroducing the exact defect class M3 named. It is a dispatch-hygiene
defect, scored major on the same standard iteration 1 used for M3, not blocking. It was
closed by the orchestrator immediately after this review, together with the minor finding n2
that shares its cause; see Conditions on the Verdict.

PR #459's four red checks remain correctly documented unmet requirements, not planning defects.

## Scope of the Check

Full re-read of all five upstream artifacts plus iteration 1's verdict. Re-validated:
traceability (issue AC to FR, FR to architecture decision, FR to story), gate integrity read
adversarially with the newly added coverage-threshold group treated as a suspect until proven
to raise enforcement, story-dependency correctness against every story's declared file list,
consistency with every recorded `> Assumption:` in research and brief, and the disposition of
each iteration-1 finding.

Step 04 (UX alignment) is again satisfied by the epics' recorded justification rather than by a
UX document: the change replaces implementations behind an unchanged design, so the visible
contract is the absence of a visual delta plus two accessibility gains, carried as per-story
accessibility criteria.

No `make` target, test or build was run. Nothing outside the spec bundle was written.

### Repository evidence verified this iteration

Eight claims were checked against repository state rather than accepted. Seven concern B1.

| # | Claim under test | Where checked | Result |
| --- | --- | --- | --- |
| 1 | The client layer keeps Jest's default imported-file coverage scope | `jest.config.ts:174` - `isClient` contributes `coverageThreshold` only; `collectCoverageFrom` is spread for `isIntegration`/`isEdge` alone | Confirmed |
| 2 | `src/test/unit/**` runs in the client layer | `jest.config.ts:23,33` - `UNIT_GLOB` is in `client`'s `testMatch` | Confirmed |
| 3 | The `check-api-versions` precedent is real, not asserted | `src/test/unit/contracts/check-api-versions.test.ts:5` imports `../../../../scripts/contracts/check-api-versions.mjs` | Confirmed - a `scripts/`-rooted `.mjs` is already under client coverage today |
| 4 | The integration layer structurally cannot collect the verifier | `jest.config.ts:67-79` - `INTEGRATION_COVERAGE_FROM` is `<rootDir>/src/**/*.{ts,tsx}` plus exclusions | Confirmed |
| 5 | The edge layer's scope is an explicit three-file list | `jest.config.ts:102-106` | Confirmed - adding a fourth file would be a deliberate act, not a drift |
| 6 | A path-keyed group at 100% **fails** on an uncovered branch **and** on an unmatched path | `node_modules/@jest/reporters/build/index.js` (jest 30.4.2): keys resolve via `path.resolve(thresholdGroup)` (:410); a matched PATH group runs `check()` on its combined coverage (:481-486); an unmatched group falls to `default:` and pushes `Jest: Coverage data for ${thresholdGroup} was not found.` into `errors`, which reaches `_setError` (:494-503) | **Confirmed in both directions** - the AC can genuinely fail |
| 7 | `make test-unit-client` runs jest from the repo root with no coverage-flag override | `Makefile:928` - `$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) --verbose`; `JEST_FLAGS = --verbose` (`Makefile:219`) | Confirmed - the CWD-relative key resolves correctly |
| 8 | The new spec does not silently acquire a second, weaker coverage home in the server layer | `Makefile:931` - `test-unit-server` passes `$(TEST_DIR_APOLLO)` as a positional filter, so `src/test/unit/**` does not execute there despite sharing `UNIT_GLOB` | Confirmed - "the client layer and no other" holds mechanically |

Evidence 6 is the one that decides B1. Iteration 1's objection was that the AC reported green
whether or not the verifier was covered. Under the corrected design, deleting the spec's import
of the module - the cheapest way to make a coverage obligation evaporate - produces a named,
loud failure rather than a silent pass. That is the property the finding demanded.

## Disposition of Iteration-1 Findings

Iteration 1's prose said "one blocking, four major, eight minor" while its own findings table
carried ten minors (m1-m10). The table is authoritative; the count below is against the table.

| ID | Was | Now | Evidence |
| --- | --- | --- | --- |
| **B1** | Verifier coverage placed in a layer that cannot collect it; AC unfalsifiable | **Closed** | Stated identically in three places: architecture Test Strategy ("client... path-keyed group... falsifiable in **both** directions", with the literal key `'./scripts/verifyUiToolkit.mjs'`), PRD FR26 + Measurable Outcomes + closing `> Assumption:`, epics Story 1.2 (two dedicated ACs) and FR26 inventory. Story 6.3 no longer carries the AC and now actively disclaims the layer ("no claim about `scripts/verifyUiToolkit.mjs` may rest on this story"). Mechanism verified as evidence 6 above; the `<rootDir>`-vs-relative caveat the architecture records is also correct - a `<rootDir>`-prefixed key would fall to `default:` and fail loudly |
| **M1** | Adapter count stated three ways; FR9's cap admitted a fourth | **Closed** | Three everywhere: brief:48 ("Three seams are adapters... `ui-text-field-form`... sits outside the adapter count"), PRD Exec Summary + FR9 + Out-of-scope + `> Assumption:`, architecture AD-2 + `> Assumption:`, epics FR9 inventory + Epic 4 governing rule + `> Assumption:`. FR9 now reads "A **fourth** adapter is a scope change" in the PRD and identically in the epics inventory. `ui-text-field-form` is named a **composite** in all four |
| **M2** | Gap 7 unfiled; FR33 fallback had no exit for Epics 8 and 9 | **Closed** | Gap 7 (per-component entry points) is now the seventh item in PRD FR37 and epics Story 9.2, and is explicitly marked as retiring no adapter. The exit is stated three times consistently - PRD FR33, architecture AD-10 "Fallback (FR33), stated explicitly", epics Story 7.2 + Epic 8 header + graph LAYER 5 note: gap 7 filed, **Epic 8 suspended not skipped**, Epic 9 runs in full, PR #459 to **draft**. Story 9.2 adds "filed on **both** branches", which closes the ordering hole (9.2 sits in LAYER 3, ahead of 7.2 in LAYER 4) |
| **M3** | 6.4 and 6.5 share `interaction-states.ts` with no declared edge | **Closed** | Marking now reads `Dependent (4.2, 6.1, 6.5 — src/test/a11y/interaction-states.ts is Story 6.5's file and 6.5 must land first)`; the file list narrows 6.4's edit to "the locators inside", 6.5 keeps registry ownership; graph LAYER 3 edge updated to `6.4 ... 4.2, 6.1, 6.5 (same file...)`; a new `> Assumption:` records why splitting ownership was rejected |
| **M4** | FR37 appeared zero times in the architecture | **Closed** | "Adapter deprecation" now ends with `**Trace.** FR37; AC8` plus an explicit "process obligation... needs no design decision of its own and has none", and the Component & File Map gains a row for the upstream issues tagged FR37. A closing `> Assumption:` records why the absence is stated rather than left implicit |
| m1 | FR32 pointed at a cleared hypothesis | Closed | FR32 now carries "**already ruled out by measurement**... recorded in the architecture's AD-10 step 2" |
| m2 | FR2's "interpolating" unimplementable for `package.json` | Closed | FR2 now reads "restating it verifiably - held to the pin by a gate, in the `.nvmrc` shape... (recorded as an architecture assumption under AD-9)" |
| m3 | `lint-ui-toolkit` executor and missing-tree behaviour unspecified | Closed | AD-9 states the recipe `$(DEV_READY) $(PM_EXEC) node scripts/verifyUiToolkit.mjs` and "An absent or partial installed tree is therefore a **hard failure naming the missing artifact**, never a skip"; Story 1.3 carries it as a dedicated AC |
| m4 | The `make lint` half of AC5 owned by no story | Closed | Story 9.1 gains "`make lint` and `make ci-lint` are green with `lint-ui-toolkit` included in both aggregates... asserted once here, in the last story in the graph (AC5...)". 9.1 is LAYER 6, so "last" is accurate. Residual: the PRD's AC5 row still lists only the Jest-half FRs - the correction was taken on the story side, as recommended |
| m5 | NFR4 claimed but no story named `make lint-metrics` | Closed | Present as an AC in Stories 4.1, 4.3 and 4.4, each with "reduced by refactoring the adapter, never by editing the policy or excluding the file" |
| m6 | AC2 names `UiTextFieldForm`, which reaches no FR | Closed | The AC2 row now carries an inline parenthetical explaining it is a composite carried by FR9's clause and the Out-of-scope entry |
| m7 | Story 6.1 did not assert the four localization regeneration paths | Closed | A dedicated AC names Jest `globalSetup`, the `lint`/`lint-deps` prerequisite, the `start-prod` recipe and Stryker's `ignorePatterns`, with the repository's own cascade history as the stated reason |
| m8 | Cross-epic edge not noted in Epic 4; Story 4.3 missing the doc-comment AC | Closed | Epic 4 header states the backward edge to 6.1; Story 4.3 now carries the doc-comment AC naming its regression tests and gap 2, matching 4.1 and 4.4 |
| m9 | FR6 mixed an obligation with unfalsifiable findings | Closed | FR6 is split into the obligation and an explicitly labelled "*Rationale, measured rather than required*" clause, with the `success` delta routed to Story 3.1's contract spec; the epics' FR6 inventory line matches |
| m10 | NFR10 rested on an unstable CLS discriminator | Closed | NFR10 now names FR18's recompute (architecture Build B) as authoritative and CLS as "corroborating evidence only"; Story 5.1's accessibility acceptance repeats it verbatim |

**Disposition: 15 of 15 closed.** No finding was closed by weakening the requirement it
described; each was closed by adding a mechanism, a named layer, or an explicit exit.

## New Findings

| ID | Severity | Artifact(s) | Description | Recommended correction |
| --- | --- | --- | --- | --- |
| **N1** | **major** | epics (Story 1.2, Story 2.1, dependency graph) | The B1 correction added `jest.config.ts` to Story 1.2's file list. Story 2.1 already owns `jest.config.ts` (the `moduleNameMapper` and `transformIgnorePatterns` entries). Neither declares a dependency on the other: 1.2 is `Dependent (1.1)`, 2.1 is `Independent`. This is the **exact defect class M3 named**, reintroduced by the fix for B1, and it violates the epics' own recorded rule - "touches the same file as another story is sufficient to mark a story Dependent" - which that same document reaffirms with "the layer numbering that happens to serialise 6.5 before 6.4 is not a declared dependency a dispatcher would read". The graph's LAYER 0 / LAYER 1 split is the only thing separating them, and it separates them only if 2.1 completes before 1.1 does; a dispatcher reading declared edges will release 1.2 the moment 1.1 lands, while 2.1 may still be in flight. The two edits are in disjoint regions of the file (`moduleNameMapper`/`transformIgnorePatterns` vs. the `CLIENT_COVERAGE_THRESHOLD` block), so the cost is a merge conflict rather than a wrong result | Mark Story 1.2 `Dependent (1.1, 2.1 — jest.config.ts)` and add the edge to the graph's LAYER 1 line for 1.2. Alternatively, move the `coverageThreshold` group into Story 2.1's file ownership and have 1.2 depend on it |
| n1 | minor | epics (Story 4.2, Story 6.3) | Story 4.2's AC asserts the `_BLANK`-no-cue limitation "is asserted in `ui-toolkit-adapters.integration.test.tsx`", a file that appears only in Story 6.3's file list. 4.2 therefore carries an acceptance criterion it cannot satisfy from its own file set. The dependency direction is sound (6.3 depends on 4.2), so the assertion does land - just one story later than the AC implies | Reword 4.2's AC to "recorded as upstream gap 1 and asserted by Story 6.3", or add the integration spec to 4.2's file list |
| n2 | minor | architecture (Component & File Map) | The map's row for `jest.config.ts`/`jest.mutation.config.ts` still reads "Identical toolkit mapping + ESM allow-list entry" tagged FR21, FR22, FR23. The Test Strategy adds a second, unrelated change to the same file (the path-keyed coverage group, FR26) that the map does not reflect, so the two sections disagree about what `jest.config.ts` contains after the change. This is also the upstream half of N1 | Add FR26 and "path-keyed 100% group for the verifier" to that row |
| n3 | minor | architecture (Test Strategy), epics (Story 1.2) | Both correctly state that the threshold key is a plain relative path because Jest calls `path.resolve()` on it - verified - but neither states the precondition that makes it correct: `path.resolve()` is relative to the **process CWD**, not `rootDir`. Every documented invocation (`make test-unit-client`, container or `EXEC_MODE=host`) runs from the repository root, so the key is correct today; a future invocation from another directory would break it. It would break **loudly** (`Coverage data for ... was not found.`), so this is informational rather than a risk | Add "resolved against the process CWD, which every `make` invocation sets to the repository root" to the existing sentence |
| n4 | minor | brief (Post-MVP) | The brief enumerates upstream gaps 1-5 plus a prose "Gap 6", and mentions per-component entry points only as un-numbered Post-MVP prose. The PRD, architecture and epics now number that request **gap 7**. This is a downstream extension, not a contradiction - the brief already flags the request - but the brief is now the only artifact where the numbering stops at six | Optional: append a "Gap 7" line to the brief's Post-MVP table. The brief is an upstream artifact and the extension does not contradict it, so leaving it is defensible |

## Validation Matrices

### 1. Issue AC to FR - re-run in full

All eight reconstructed ACs reach at least one FR. Both breaks iteration 1 recorded are closed.

| Issue AC | FRs | Break? |
| --- | --- | --- |
| AC1 - swap the listed primitives behind the `@/components` seam | FR1, FR2, FR5, FR6, FR7, FR8 | none |
| AC2 - keep `UiInput`, `UiLink`, `UiButton`, `UiTextFieldForm` local | FR9-FR14 | **closed** (m6) - the row now explains `UiTextFieldForm`'s composite status inline |
| AC3 - Jest resolves the ESM-only package in both configs | FR21, FR22, FR23 | none |
| AC4 - font wiring via `styles/global.css` | FR15-FR20 | none |
| AC5 - `make lint` and every Jest layer pass, integration at 100% | FR24, FR25, FR26, FR29 | **closed at the story layer** (m4) - Story 9.1 owns the aggregate; the PRD row is unchanged by design |
| AC6 - no a11y or security weakened; no gate relaxed | FR3, FR4, FR7, FR8, FR10-FR12, FR14, FR27, FR28, FR30-FR33 | none |
| AC7 - visual regression reviewed, not blind-updated | FR18, FR34, FR35, FR36 | none |
| AC8 - upstream gaps filed | FR14, FR37 | **closed** (M2) - gap 7 is now the prerequisite FR33 waits on and is filed on both branches |

### 2. FR to architecture decision - full re-check of FR1-FR37

All 37 now reach a Decision Register entry or a tagged Test Strategy paragraph. The single
"no trace anywhere" row from iteration 1 is gone.

| Architecture decision | FRs traced |
| --- | --- |
| AD-1 seam | FR5, FR6, FR7, FR8 |
| AD-2 adapter rule | FR9, FR27 |
| AD-3 `ui-link` | FR12, FR14 |
| AD-4 `ui-input` | FR10, FR11 |
| AD-5 `ui-button` | FR13 |
| AD-6 shared i18n | FR28 |
| AD-7 font pipeline | FR15-FR19 |
| AD-8 Jest/Stryker mapping | FR21, FR22, FR23 |
| AD-9 digest and pin | FR1, FR2, FR3, FR4 |
| AD-10 byte budget + stated fallback exit | FR31, FR32, FR33 |
| AD-11 baseline isolation | FR18, FR34, FR35, FR36 |
| AD-12 CSSOM hover assertion | FR24, FR27 |
| AD-13 Storybook | FR20, FR30 |
| Test Strategy, client paragraph (tagged) | FR3, FR4, FR8, FR10, FR12, FR23, **FR26**, FR27 |
| Test Strategy, integration paragraph (tagged) | FR24, FR25 |
| "Adapter deprecation", explicit no-design-needed (tagged) | **FR37** |
| Test Strategy, e2e/a11y paragraph (tagged) | FR7, FR14, FR29 |

### 3. FR to story - full re-check

All 37 FRs reach a story and every claimed story carries a matching AC. The three deltas
iteration 1 recorded are resolved: FR9's three stories now all carry the doc-comment AC;
FR24/FR26's verifier obligation has moved from 6.3 to 1.2 with 6.3 disclaiming it; FR33's
prerequisite is owned by Story 9.2 as gap 7.

### 4. Story dependency vs. file list - checked exhaustively, not sampled

Every story's declared file list was cross-tabulated against every other story's. Shared files:

| File | Stories | Declared edge? |
| --- | --- | --- |
| `src/test/testing-library/UiCheckBox.test.tsx` | 3.3, 6.2 | Yes - 6.2 `Dependent (3.3 - same file)` |
| `src/test/testing-library/UiLink.test.tsx`, `ui-link/index.tsx`, `ui-link/types.ts` | 4.1, 4.2 | Yes - 4.2 `Dependent (4.1 - same files; 6.1)` |
| `ui-link/index.tsx`, `ui-input/index.tsx`, `ui-button/index.tsx` | 4.1-4.4, 9.2 | Yes - 9.2 `Dependent (4.1, 4.2, 4.3, 4.4)` |
| `src/test/a11y/interaction-states.ts` | 6.4, 6.5 | Yes - **M3 closed** |
| `styles/global.css` | 5.1 only (6.6 imports it from `.storybook/preview.ts`, a different file) | n/a |
| `jest.config.ts` | 1.2, 2.1 | Yes - **N1 closed after this review**: 1.2 now reads `Dependent (1.1, 2.1 - shares jest.config.ts)` and the graph's LAYER 1 line carries the edge |

### 5. Story to gate

Re-sampled by gate-bearing story. Every risk row from iteration 1 is unchanged or improved.

| Story | Gate it must turn or hold green | Relaxation risk |
| --- | --- | --- |
| 1.2 | client-layer per-file 100% group on `scripts/verifyUiToolkit.mjs` | none - **new enforcement**; fails on an uncovered branch and on a module the run never loaded |
| 1.3 | new `make lint-ui-toolkit` inside `make lint` and `CI_LINT_TARGETS`; `make test-bats` | none - executor named, missing tree is a hard failure (m3 closed) |
| 2.1 | `make test-unit-all`, `make test-mutation-changed` | none - the vacuous-pass trap is named explicitly |
| 6.2 | `unit`, `smoke`, `codecov` | none - deletion, skip, conditional, dependency-asserting and `NODE_ENV` forcing all forbidden by name |
| 6.3 | `make test-integration` at 100%, client and edge floors | none - the AC that could not fail has been removed and replaced by an explicit disclaimer |
| 6.5 | `make test-a11y`, `make test-e2e`, the registry drift guard | none - "satisfied by adding the scan, never by editing the guard" |
| 7.2 | `build-artifact` | none - raising `js_budget`, excluding a chunk and no-op chunk splitting each forbidden by name; the fallback now has a written exit |
| 8.1 | precondition for `visual-test` | none - suspended, not skipped, on the FR33 branch |
| 8.2 | `visual-test` | none - CODEOWNERS review plus one recorded cause per PNG |
| 9.1 | `make lint` + `make ci-lint` aggregates | none - new, and the correct place for it (LAYER 6) |

## Gate Integrity Statement

**No artifact in this bundle proposes lowering a threshold, relaxing a gate, blind-updating a
baseline, raising the byte budget, or adding a suppression.** The four passages iteration 1
read adversarially (AD-10's `splitChunks` group, AD-12's rewritten assertion, Story 8.2's
reviewed regeneration, NFR5's restated Lighthouse floors) are textually unchanged and still
survive that reading.

The one new gate-shaped change was treated as a suspect and cleared:

**The path-keyed `coverageThreshold` group raises enforcement and lowers nothing.** Three
independent checks. (a) The global client floor (92/95/97/97) is untouched; the group is
declared *beside* it, and the PRD, architecture and epics each say so in the same words. (b)
Jest subtracts a path group's files from the global pool - the only mechanical side effect -
and the subtracted file is held to **100%**, strictly above the floor it left, so the trade
cannot be used to hide a weakly covered module. (c) The group is falsifiable in both
directions (evidence 6), which is what distinguishes it from an ornamental criterion; iteration
1's B1 existed precisely because the previous formulation had neither direction.

Two further integrity observations, both favourable. Story 6.3 does not merely drop the AC it
could not enforce - it records **why** the layer cannot hold it, which prevents a future author
from re-adding it. And Story 1.3's fail-closed rule for an absent `node_modules` tree converts
the one remaining way this new gate could pass vacuously into a named hard failure.

The plan still **adds** two gates (`make lint-ui-toolkit`, the per-file coverage group) where
none existed, against a dependency that today has no integrity signal at all.

## Consistency with Recorded Upstream Assumptions

Every `> Assumption:` in the research and the brief was re-read against the corrected
downstream text. None is contradicted.

- Brief R1's "any surviving `@mui/material` barrel import in a seam is the first suspect" is
  **executed**, not overridden: AD-10 step 2 checks it first and records it ruled out by
  measurement. FR32 now points at that measurement (m1).
- Brief R3 permits a fallback in which the unit assertion moves to Playwright "with its
  replacement named in the same diff". AD-12 adopts the primary CSSOM fix and rejects the
  fallback on stated grounds (a 235th baseline). The fallback is not reached, so this is a
  narrowing, not a contradiction; FR27's "may move layers only when its replacement is named in
  the same diff" preserves the brief's clause verbatim.
- Brief R5's asymmetry (accept the `UiTypography` widening, refuse the `UiInput` one) is
  carried unchanged through FR11, AD-4 and Story 4.3.
- Brief R7's "sixth upstream-gap item" survives as gap 6; gap 7 is added downstream and is
  additive to the brief's own Post-MVP prose (n4).
- The adapter-count reconciliation at brief:48 does not disturb the Proposed Solution table's
  four rows - it relabels the fourth as a composite, which is what the table's own text says.

## Residual Risks Accepted

| # | Risk | Why it is accepted |
| --- | --- | --- |
| RR1 | Story 7.2 can terminate in "not shippable in this form" | Unchanged as an outcome, but no longer a planning risk: the branch now has an owner for its prerequisite (gap 7), a stated disposition for Epics 8 and 9, and a stated fate for PR #459. Downgraded from iteration 1 |
| RR2 | The font fallback-metric recompute rule is a documented procedure, not a gate | Named by the architecture as "this design's weakest verification link". Story 8.1's Build B is the compensating control; NFR10 now says explicitly that CLS cannot substitute for it |
| RR3 | The dependency is outside SCA coverage | `osv-scanner` cannot key a remote-tarball entry to a package coordinate. AD-9's digest makes a *substitution* detectable; an unsurfaced upstream advisory is genuinely uncovered |
| RR4 | AD-10 may find neither hypothesis closes 36,275 B | The plan's answer is to stop, not to ship over. Feeds RR1 |
| RR5 | `bun.lock` records no `sha512`; `Dockerfile:21` refetches on every cache miss | Mitigated to the point the repository can reach: the digest is verified at the fetch point in the `base` stage. `CONSUMING.md`'s tamper-evidence claim is forbidden from being repeated |
| RR6 | Story 6.2's AC asserts `codecov` clears downstream of the unit fix | If codecov has an independent cause (upload or token), 6.2 is blocked by something outside its file list |
| RR7 | Six of nine seams become re-exports whose values arrive from a dependency | Compensated by Story 3.1's contract spec, which pins the breakpoints and every consumed palette token including the WCAG-bearing foreground/background pairs |
| RR8 | **New.** The verifier's coverage group is keyed on a CWD-relative path | Correct for every documented invocation and fail-loud if violated (n3). Recorded so a future runner change is not mistaken for a coverage regression |

## Conditions on the Verdict

The verdict is **PASS**. Implementation may proceed. Two conditions attached; both of the
ones that gate dispatch were closed immediately after this review, by the orchestrator:

1. **(N1, major - CLOSED.)** Story 1.2 now reads `Dependent (1.1, 2.1 - shares
   `jest.config.ts` with 2.1)` and the dependency graph's LAYER 1 line carries the edge, so
   no dispatcher reading declared edges can put two agents in that file. This applies the
   same standard the epics use for 6.2/3.3, 4.2/4.1 and 6.4/6.5, and the same one M3 named.
2. **(n2, minor - CLOSED.)** The architecture's Component & File Map row for
   `jest.config.ts` now names its second purpose and traces FR26 alongside FR21-FR23.
3. **(n1, n3, n4, minor - advisory, left open.)** One-sentence clarifications that mislead no
   implementer. n4 is optional: the brief is upstream and the downstream gap numbering
   extends rather than contradicts it.

The four red CI checks on PR #459 remain outside this verdict: they are documented unmet
requirements with named root-cause fixes and named forbidden shortcuts, which is a PASS
condition, not a defect of the plan.

## Assumptions Recorded by This Review

> Assumption: N1 is scored **major**, not blocking, on the same standard iteration 1 used for
> M3 - an undeclared shared-file edge is a dispatch-hygiene defect, not a traceability break,
> a misleading contradiction, or a gate-integrity violation. An implementer working serially
> would produce the correct result; the exposure is a merge conflict under parallel dispatch.

> Assumption: verifying B1 required checking the enforcement mechanism against the runner, not
> just against the three documents. A coverage criterion stated identically in three artifacts
> is still unfalsifiable if the tool ignores it, which is precisely how B1 arose. Jest 30.4.2's
> threshold implementation was read directly; the corrected design fails in both directions.

> Assumption: the absence of a UX specification remains correct rather than a missing input,
> on the same grounds recorded in iteration 1.

> Assumption: PR #459's four red checks are a correctly documented state of the world. The
> PRD's "Current Gaps vs PR #459" section states them as unmet FRs with evidence.

> Assumption: where the architecture supersedes a PRD statement through an explicit
> `> Assumption:`, the architecture governs. Both superseded passages (FR2's interpolation,
> FR32's first suspect) are now annotated in the PRD rather than rewritten, which is the
> correction iteration 1 asked for.

> Assumption: downstream numbering of a request the brief raises in prose (per-component entry
> points, now gap 7) is an extension of the brief, not a contradiction of it, and therefore
> does not violate the "never contradict an upstream artifact" rule.
