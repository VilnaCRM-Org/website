---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - ./prd-458-ui-toolkit-primitives-2026-09-09.md
  - ./architecture-458-ui-toolkit-primitives-2026-09-09.md
  - ./brief-458-ui-toolkit-primitives-2026-09-09.md
  - ./research-458-ui-toolkit-primitives-2026-09-09.md
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - CLAUDE.md, AGENTS.md, .claude/react-sdlc.yml
workflowType: epics-and-stories
status: Draft
---

# website - Epic Breakdown: wire `@vilnacrm/ui-toolkit` into the site (#458)

## Overview

This breakdown turns the PRD (`prd-458-ui-toolkit-primitives-2026-09-09.md`, FR1-FR37 / NFR1-NFR17) and its architecture (`architecture-458-ui-toolkit-primitives-2026-09-09.md`, AD-1 to AD-13) into an implementable plan for making `@vilnacrm/ui-toolkit@0.3.0` the single design source for nine `src/components/ui-*` modules. The device the whole plan rests on is the **import seam**: `src/components/<dir>/index.{ts,tsx}` keeps its path and its default export and its body becomes either a one-line re-export or a thin adapter, so all 93 import statements (79 outside the test trees), `src/components/index.ts` and the `@landing`/`@swagger` consumers stay invariant.

This is a **retrospective** plan: PR #459 already realises most of it and is red on four checks (`build-artifact`, `visual-test`, `unit`/`smoke`, `codecov`). The stories below therefore include the root-cause fixes for those checks as first-class work, and never as threshold moves — NFR17 forbids relaxing any gate, budget, allow-list or baseline, and every story that touches a gate says so explicitly.

The work splits into two halves with very different blast radii. Nine seams and three adapters are contained and provable by specs that already exist. Replacing `next/font/local` with real-named `@font-face` declarations changes what every page paints — 132 of 156 visual tests move and `uk_largeMobile` changed *height* (414x1562 to 414x1541) — and that half is not optional, because the toolkit's themes name the families literally (`fontFamily:"Inter"` 36x, `fontFamily:"Golos Text"` 22x) and a `next/font`-generated family name can never satisfy a literal reference.

## Requirements Inventory

### Functional Requirements

Condensed from the PRD's `## Functional Requirements`; the PRD text is authoritative where the two differ.

- FR1: Pin the toolkit to exactly one immutable release-tarball URL (a git ref is impossible — entry points resolve into the gitignored `build/`).
- FR2: One source-of-truth version variable, `UI_TOOLKIT_VERSION`, with every consumer restating it verifiably; a rival variable is a defect.
- FR3: Commit the artifact SHA-256 and verify it before use, modelled on `contracts/user-service/checksums.json` + `make lint-contracts`.
- FR4: Verification runs offline and does not trust `bun.lock`, whose remote-tarball entry carries no `sha512`.
- FR5: `ui-color-theme`, `ui-breakpoints`, `ui-typography`, `ui-checkbox`, `ui-toolbar`, `ui-tooltip` re-export the toolkit from their existing paths.
- FR6: The seam holds at the **path** level, not only at the barrel; the 28/22 deep-import counts and the `UiBreakpoints`/`UiColorTheme` value identity are the measurements behind that obligation, checked by Story 3.1's contract spec rather than asserted as requirements.
- FR7: `ui-tooltip` retires `tooltip-wrapper.tsx` while preserving click-toggle, ClickAway dismissal and close-on-breakpoint, and gains keyboard operation.
- FR8: `ui-checkbox` retires `styles.ts`/`types.ts` and renders MUI's control behind `span.ui-checkbox-box` with identical tokens.
- FR9: A seam becomes an adapter only where a committed assertion would go red; each adapter names that test. The set is **exactly three** — `ui-link`, `ui-input`, `ui-button` — and a **fourth** adapter is a scope change; `ui-text-field-form` is a local composite over those seams, not an adapter, and is outside the count.
- FR10: `ui-input` keeps `buildInputSlotProps` so `aria-describedby`/`aria-required` land on the `<input>`.
- FR11: `UiInputProps` stays an explicit prop allow-list over the toolkit type, not the whole of `TextFieldProps`.
- FR12: `ui-link` keeps `resolveExternalLinkRel` (case-folded `target`, merged caller `rel` tokens).
- FR13: `ui-button` keeps the falsy-`href` drop and declares `rel`/`target` on its prop type.
- FR14: `ui-link` localizes `newTabLabel` and suppresses the toolkit's hardcoded English default; the `_BLANK`-no-cue limitation is asserted.
- FR15: `styles/global.css` declares `Inter` and `Golos Text` under their real names over the committed `.woff2` (472,032 B).
- FR16: `next/font/local` is dropped for these families; no page may depend on a generated class for them.
- FR17: The toolkit's `styles.css` (`.ttf`, 1,348,788 B) is rejected as the mechanism; added font payload is zero.
- FR18: The metric-adjusted fallback overrides are derived data with a recorded recompute rule, not constants.
- FR19: `_fonts.scss` names real families instead of `next/font`'s hand-copied generated hashes.
- FR20: `.storybook/preview.ts` imports `styles/global.css`; `.storybook/main.ts` drops the dead `staticDirs` font block.
- FR21: `jest.config.ts` maps the ESM-only package to its built bundle (no `require` condition exists).
- FR22: `jest.mutation.config.ts` carries the identical mapping, or every mutant reads as survived.
- FR23: Both configs extend the ESM `transformIgnorePatterns` allow-list; a divergence between them is a defect.
- FR24: Every Jest layer passes, with the integration layer still at 100%.
- FR25: Every adapter branch is driven at the integration layer, including `_BLANK`, falsy-`href`, caller-`rel` merge and localized cue.
- FR26: Client and edge layers hold their floors (client >= 92/95/97/97; edge 100% per file), and `scripts/verifyUiToolkit.mjs` holds a dedicated per-file 100% group inside the client layer.
- FR27: No accessibility or security assertion is deleted, skipped, made conditional, or satisfied against the dependency's own exports.
- FR28: The new-tab i18n key lives in a shared namespace, not a feature bundle.
- FR29: Every name-based locator affected by the cue is repaired in the same change.
- FR30: The six deleted Storybook stories are rewritten against the seams, not left deleted.
- FR31: Measured static JS is at or below 3,300,000 B; the budget is not an input.
- FR32: A `make build-analyze` bundle diff against `main` is the first artifact of the byte fix.
- FR33: If no trim closes the 36,275 B gap, the change is not shippable in this form — with a stated exit: gap 7 is filed, Epic 8 is suspended rather than skipped, Epic 9 still runs, and PR #459 goes to draft.
- FR34: No visual baseline is regenerated before the cause of its movement is established.
- FR35: The two candidate causes are separated mechanically by a multi-build experiment before any PNG is touched.
- FR36: Each regenerated PNG carries a written cause, reviewed by the CODEOWNERS owner; only the `uk` lane ran.
- FR37: All seven upstream gaps are filed with the adapter each keeps alive and the condition that retires it; gap 7 (per-component entry points) retires no adapter and is FR33's prerequisite.

### Non-Functional Requirements

- NFR1: Integration coverage 100%; client and edge hold their configured floors. Raise-only.
- NFR2: Mutation MSI 100% for `curated`; the scope must not be altered to accommodate this change.
- NFR3: ESLint 0 errors / 0 warnings, `tsc` 0, markdownlint 0, dependency-cruiser 0, jscpd 0, visual diffs 0.
- NFR4: `config/metrics-policy.json` hard thresholds apply unchanged to every seam and adapter file.
- NFR5: Lighthouse floors hold at 85 desktop / 40 mobile plus the per-URL byte assertions.
- NFR6: WCAG 2.1 AA at all three layers; scans gate on serious/critical **and** unset impact.
- NFR7: The tooltip's new keyboard states are registered in `src/test/a11y/interaction-states.ts` and driven by `scanInteractionState`.
- NFR8: Static JS <= 3,300,000 B by payload reduction.
- NFR9: No added font payload; the `.ttf` route is rejected.
- NFR10: Every declared face uses `font-display: swap`; fallback metrics keep CLS inside existing assertions.
- NFR11: `rel` hardening is case-insensitive on `target`.
- NFR12: No `describedBy` loss — ARIA reaches the `<input>`, not the FormControl.
- NFR13: Integrity is provable offline from a committed SHA-256; it is the only integrity signal this dependency has.
- NFR14: The public-API seam holds; a shared primitive never imports a feature.
- NFR15: Every new module has a real importer (`no-orphans`); the toolkit stays in `dependencies`.
- NFR16: No hardcoded English; every user-facing string resolves through `t()` against `en` and `uk`.
- NFR17: No gate, threshold, budget, allow-list or baseline may be relaxed to make this change pass.

### Architecture Decisions (binding)

AD-1 same-path re-export seam · AD-2 an adapter only where a committed assertion fails · AD-3 `ui-link` case-folded `rel` + localized cue · AD-4 `ui-input` `slotProps.htmlInput` + `Pick` allow-list · AD-5 `ui-button` falsy-`href` + `rel`/`target` types · AD-6 shared i18n namespace merged last by `LocalizationGenerator` · AD-7 real-named `@font-face` over the committed `.woff2` · AD-8 identical mapping in both Jest configs · AD-9 committed SHA-256 verified offline and at the fetch point · AD-10 directed byte trim with a named not-shippable outcome · AD-11 three-build baseline isolation · AD-12 CSSOM read for the hover token · AD-13 Storybook rewritten against the seams.

### UX Design Requirements

No UX specification exists for this change and none is needed: it replaces implementations behind an unchanged design, so the visible contract is the *absence* of a visual delta (Epic 8) plus two accessibility gains — the tooltip's keyboard operation and the checkbox's `aria-invalid`. Those are carried as accessibility acceptance criteria on the individual stories rather than as separate UX requirements.

## Epic List and Sequencing

The epics are ordered by what each one **unblocks**, not by the order the decision register introduces them.

1. **Epic 1 - Dependency pin and supply-chain digest** (FR1-FR4). Nothing may import a dependency the tree cannot prove it fetched. This is also the one gap with no CI signal today.
2. **Epic 2 - Jest and Stryker module resolution** (FR21-FR23). Placed second, ahead of the seams, because until the ESM-only package resolves under the CJS runner *no* spec that transitively imports `@/components` can run — every later epic's proof depends on it.
3. **Epic 3 - Import seams and re-exports** (FR5-FR8). The substrate the adapters sit on.
4. **Epic 4 - Adapters preserving accessibility and security** (FR9-FR14). Cannot start before the seam shape exists.
5. **Epic 5 - Font pipeline** (FR15-FR19). Independent of the seams in file terms, but it is what makes the toolkit's literal family references resolve, so it must land before anything is measured for bytes or pixels.
6. **Epic 6 - Tests, Storybook stories and shared i18n** (FR20, FR24-FR30). **Unblocks the first red check.** Story 6.2 fixes the one failing Jest case, which fails `unit`, `smoke` and — downstream — `codecov`. It is the earliest of the three red checks that can be closed, and nothing else can be trusted while a test lane is red.
7. **Epic 7 - Static-JS byte budget** (FR31-FR33). **Unblocks the second red check.** `build-artifact` is measured over a production build, so the gap can only be attributed once Epics 3-5 exist; and a chunk split introduced here changes what Epic 8 photographs.
8. **Epic 8 - Visual-baseline isolation and review** (FR34-FR36). **Unblocks the last red check**, and deliberately last: the isolation experiment must run against the final font pipeline *and* whatever chunk split Epic 7 introduces, or it separates the wrong variables. **Conditional:** if Story 7.2 ends in FR33's not-shippable verdict this epic is **suspended, not skipped** — there is no byte-fixed tree to isolate against — and its exit is written into Story 7.2 rather than left to a dispatcher to infer.
9. **Epic 9 - Documentation sync and upstream gap filing** (FR37). Records what the previous eight established, and runs **in full on either branch**: on FR33's not-shippable path, Story 9.2's gap-7 filing is precisely what makes re-entry possible.

One dependency runs backwards against this order and is called out rather than hidden: Story 4.2 (the localized new-tab cue) needs Story 6.1's shared i18n namespace. Story 6.1 is Independent and can be dispatched at any point, so the graph, not the epic number, is the dispatch input.

## Epic 1 Stories: Dependency Pin and Supply-Chain Digest

### Story 1.1: Pin the release tarball behind a single `UI_TOOLKIT_VERSION`

**As a** CI maintainer, **I want** the toolkit pinned to one immutable release-tarball URL derived from a single authoritative version variable, **so that** no consumer restates a tag nobody re-derives and a substitution is detectable.

**Implements:** FR1, FR2 (AD-9) | **Marking:** Independent | **Files:** `package.json`, `bun.lock`, `.env`, `.env.example`

- **Given** `.env` and `.env.example`, **When** the pin is added, **Then** both declare `UI_TOOLKIT_VERSION=v0.3.0` and agree, and no second toolkit version variable exists anywhere in the tree (FR2).
- **Given** `package.json`, **When** the dependency is declared, **Then** it is the release-tarball URL for exactly that version, in `dependencies` (never `devDependencies`, per NFR15's `not-to-dev-dep`), and a git ref is not used (FR1).
- **Given** `bun.lock`, **When** it is regenerated, **Then** its spec names the same version, and the change record states plainly that the entry carries **no** `sha512` and that `CONSUMING.md`'s tamper-evidence claim does not hold for this dependency form (FR1, FR4).

### Story 1.2: Commit the SHA-256 digests and author the offline verifier

**As a** security-conscious maintainer, **I want** the installed artifacts' SHA-256 committed and checked offline, **so that** a re-cut GitHub release asset fails the build instead of shipping in it.

**Implements:** FR3, FR4, FR26 (AD-9, NFR13) | **Marking:** Dependent (1.1, 2.1 — shares `jest.config.ts` with 2.1) | **Files:** `config/ui-toolkit-checksums.json` (new), `scripts/verifyUiToolkit.mjs` (new), `src/test/unit/contracts/verify-ui-toolkit.test.ts` (new), `jest.config.ts`

- **Given** `config/ui-toolkit-checksums.json`, **When** it is committed, **Then** it records `algorithm`, `version`, `tarballUrl` and a per-artifact SHA-256 for `build/{index.mjs,index.css,index.d.ts}` plus the tarball itself (FR3).
- **Given** `scripts/verifyUiToolkit.mjs`, **When** it runs, **Then** it hashes the **installed** `node_modules/@vilnacrm/ui-toolkit/build/*`, compares each against the committed digest, asserts the installed `package.json` `version` and that `.env`, `package.json` and `bun.lock` all name `UI_TOOLKIT_VERSION` — with **no** network, host binary or Docker (FR3, FR4, NFR13).
- **Given** `--checksums=`, **When** omitted, **Then** it defaults to `config/ui-toolkit-checksums.json`, so one invocation form works on the host and in the container (AD-9).
- **Given** the spec, **When** it runs under `make test-unit-client`, **Then** a mismatched digest fails, a **missing** digest file fails rather than passing vacuously, an unsupported `algorithm` fails, and a pin disagreement between the three files fails (FR3, FR4).
- **Given** the coverage home, **When** it is chosen, **Then** it is the **client** layer and no other: `src/test/unit/contracts/verify-ui-toolkit.test.ts` matches the client layer's `src/test/unit/**/*.test.ts` glob and that layer keeps Jest's default imported-file coverage scope — the same route `src/test/unit/contracts/check-api-versions.test.ts` already uses for `scripts/contracts/check-api-versions.mjs`. It is **not** claimed at the integration layer, whose `INTEGRATION_COVERAGE_FROM` is `src/**` plus exclusions and therefore never collects a `scripts/`-rooted module, and `scripts/verifyUiToolkit.mjs` is **not** added to `EDGE_COVERAGE_FROM`, whose scope is the shipped runtime scripts (FR26, NFR17).
- **Given** `jest.config.ts`, **When** the client layer's thresholds are declared, **Then** they gain a path-keyed group `'./scripts/verifyUiToolkit.mjs': { branches: 100, functions: 100, lines: 100, statements: 100 }` beside the global 92/95/97/97 floor — a plain relative key, because Jest resolves a threshold key with `path.resolve()` and does not interpolate `<rootDir>` — and the global floor is left untouched. This adds enforcement where the global floor could not fail on one uncovered module; it lowers nothing (FR26, NFR1, NFR17).
- **Given** `make test-unit-client`, **When** it runs, **Then** `scripts/verifyUiToolkit.mjs` reports **100%** statements / branches / functions / lines under that group. The criterion fails in both directions and is verified to: removing a case for one verifier branch fails the threshold, and removing the spec's import of the module fails the run with `Jest: Coverage data for ./scripts/verifyUiToolkit.mjs was not found.` (FR3, FR24, FR26).

### Story 1.3: Wire `lint-ui-toolkit`, `update-ui-toolkit` and the Dockerfile verification

**As a** CI maintainer, **I want** the verifier wired into `make lint` and into the image build where the fetch actually happens, **so that** the digest is enforced in every environment rather than documented in one.

**Implements:** FR3, FR4 (AD-9) | **Marking:** Dependent (1.2) | **Files:** `Makefile`, `Dockerfile`, `tests/bats/make-target-coverage.tsv`, `tests/bats/makefile_targets.bats`

- **Given** the Makefile, **When** the targets are added, **Then** `lint-ui-toolkit` joins the `lint` aggregate and `CI_LINT_TARGETS` (it is hermetic, the same reasoning that puts `lint-api-versions` there and keeps `lint-contracts` out), its recipe is `$(DEV_READY) $(PM_EXEC) node scripts/verifyUiToolkit.mjs` so it runs in the dev container like every other npm-tool gate (#399), and `update-ui-toolkit` is the maintainer-only, networked refresher that rewrites the digests (FR3).
- **Given** an absent or partial `node_modules/@vilnacrm/ui-toolkit`, **When** `make lint-ui-toolkit` runs, **Then** it exits non-zero naming the artifact it could not read — never skipping and never passing. Its precondition is stronger than `lint-api-versions`' (committed files only) and `lint-pins`' (deliberately dependency-free), so the fail-closed rule has to be stated: a supply-chain check that quietly passes when it cannot look is worse than no check (FR3, FR4, NFR13).
- **Given** the `base` stage, **When** the image is built, **Then** `config/ui-toolkit-checksums.json` is COPYed and `bun install --frozen-lockfile && node verifyUiToolkit.mjs` runs, so a substituted release asset fails the image build (FR3, AD-9).
- **Given** a hand-edited digest, **When** `make lint-ui-toolkit` runs, **Then** it exits non-zero and names the artifact that disagrees (FR3, NFR13).
- **Given** `tests/bats/make-target-coverage.tsv`, **When** the rows are added, **Then** both targets carry `bats` evidence and a dedicated case in `tests/bats/makefile_targets.bats`, and `make test-bats` passes (repo convention: `bats` means a dedicated Bats test exists).

## Epic 2 Stories: Jest and Stryker Module Resolution

### Story 2.1: Map the ESM-only package identically in both Jest configs

**As a** developer, **I want** the bare specifier mapped to the built bundle in `jest.config.ts` **and** `jest.mutation.config.ts`, **so that** specs resolve under the CJS runner and Stryker cannot report false survivors.

**Implements:** FR21, FR22, FR23 (AD-8) | **Marking:** Independent | **Files:** `jest.config.ts`, `jest.mutation.config.ts`, `src/test/unit/jest-config-parity.test.ts` (new)

- **Given** both configs, **When** the mapping is added, **Then** each maps `@vilnacrm/ui-toolkit` to `<rootDir>/node_modules/@vilnacrm/ui-toolkit/build/index.mjs` and the `styles.css` subpath to `build/index.css`, because the package's `exports` map declares no `require` condition and the failure is at *resolution*, not parse (FR21, FR22).
- **Given** the ESM allow-list, **When** it is extended, **Then** both read `'/node_modules/(?!(uuid|@faker-js/faker|@vilnacrm/ui-toolkit)/)'` so babel-jest transforms the `.mjs` (FR23).
- **Given** the parity spec, **When** it runs under `make test-unit-client`, **Then** it imports both configs and asserts the toolkit-related `moduleNameMapper` and `transformIgnorePatterns` entries are **equal**, so FR23's "a divergence is a defect" is enforced rather than documented (FR23).
- **Given** `make test-mutation-changed`, **When** it runs, **Then** related specs that transitively import `@/components` load and execute; a run that resolves nothing and exits 0 is treated as a failure, not a pass (FR22, NFR2).
- **And** no `ui-*` file is added to `stryker.config.mjs`'s curated list or to `config/mutation-policy.json` to accommodate this change (NFR2, NFR17).

## Epic 3 Stories: Import Seams and Re-exports

### Story 3.1: Re-export `ui-color-theme` and `ui-breakpoints` and pin their values by contract

**As a** contributor, **I want** the theme and breakpoint modules to re-export the toolkit's website tokens, **so that** the tokens stop being maintained twice while their values stay provable.

**Implements:** FR5, FR6 (AD-1) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-color-theme/index.ts`, `src/components/ui-breakpoints/index.ts`, `src/test/unit/ui-toolkit-theme-contract.test.ts` (new)

- **Given** each module, **When** rewritten, **Then** it re-exports `websiteColorTheme as UiColorTheme` / `websiteBreakpointsTheme as UiBreakpoints` from its existing path and keeps its default export, so all 28 + 22 deep imports and `src/components/index.ts` are byte-identical (FR5, FR6) — proven by `make lint-tsc` and `make lint-deps`.
- **Given** the contract spec, **When** it runs under `make test-unit-client`, **Then** it asserts `UiBreakpoints.breakpoints.values` is `{xs:375, sm:640, md:768, lg:1024, xl:1440}` and that every palette token this repository reads still holds its value — a re-exported value now arrives from a dependency and needs an assertion of its own (FR6, NFR3).
- **And** the `success` token difference is recorded as the one intentional value delta, and confirmed unreferenced in this tree.
- **Accessibility acceptance:** the contract spec asserts the foreground/background token pairs this site renders are unchanged, so no WCAG 2.1 AA contrast ratio can move silently through a theme swap; a changed token is a failing assertion, never a baseline update.

### Story 3.2: Re-export `ui-typography` and `ui-toolbar`

**As a** contributor, **I want** typography and toolbar to render from the toolkit, **so that** two more duplicate implementations retire.

**Implements:** FR5 (AD-1, AD-2) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-typography/index.tsx`, `src/components/ui-typography/{theme,types}.ts` (deleted), `src/components/ui-toolbar/index.tsx`, `src/components/ui-toolbar/theme.ts` (deleted)

- **Given** each seam, **When** rewritten, **Then** it is a re-export, the local `theme.ts`/`types.ts` are deleted, and `make lint-deps` reports no `no-orphans` violation from the deletions (FR5, NFR15).
- **Given** `UiTypography`'s prop surface, **When** it widens from a closed `component` union plus an ARIA allow-list to `ElementType` + `...rest`, **Then** no committed assertion goes red, so per AD-2 no adapter is created; the widening is recorded as accepted because it encoded a convention, not a safety property (FR9).
- **And** `make test-unit-client` and `make test-integration` pass with the existing typography assertions unmodified (FR27).
- **Accessibility acceptance:** ARIA props passed by call sites still reach the rendered element through `...rest` — asserted, not assumed; the rendered element's role and accessible name are unchanged for every existing consumer; `expectNoA11yViolations` continues to pass on the components that compose it.

### Story 3.3: Re-export `ui-checkbox` onto MUI's control

**As an** end user, **I want** the checkbox to render the toolkit's control, **so that** I gain its `aria-invalid` without losing this site's design tokens.

**Implements:** FR8 (AD-1) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-checkbox/index.tsx`, `src/components/ui-checkbox/{styles,types}.ts` (deleted), `src/test/testing-library/UiCheckBox.test.tsx`

- **Given** the seam, **When** rewritten, **Then** it re-exports the toolkit component, `styles.ts` and `types.ts` are deleted, and the rendered control preserves the `1.5rem` box, `0.5rem` radius and `grey400`/`error` borders on `span.ui-checkbox-box` (FR8).
- **Given** the existing token assertions, **When** they follow the box node, **Then** they are *moved*, never relaxed, skipped or made conditional, and the default and error token cases pass under `make test-unit-client` (FR27).
- **And** the check SVG is unchanged, and `make test-visual` movement for this component is left to Epic 8 rather than baselined here (FR34).
- **Accessibility acceptance:** label association survives (the control is reachable by `getByLabelText`/`getByRole('checkbox', { name })`); the disabled and controlled-`checked` states are asserted; the toolkit's new `aria-invalid` is exercised in both states; the control is focusable and operable by Space with a visible focus indicator; `expectNoA11yViolations` passes at 0 serious/critical and 0 unset-impact findings.

### Story 3.4: Re-export `ui-tooltip` and retire `tooltip-wrapper.tsx`

**As a** keyboard user, **I want** the tooltip to render from the toolkit, **so that** I can open and dismiss it without a pointer.

**Implements:** FR7 (AD-1) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-tooltip/index.tsx`, `src/components/ui-tooltip/{theme.ts,tooltip-wrapper.tsx,types.ts}`, `src/test/testing-library/UiTooltip.test.tsx`, `src/test/testing-library/UiTooltipWrapper.test.tsx`, `tests/integration/coverage/misc-small/tooltip-wrapper.integration.test.tsx`

- **Given** the seam, **When** rewritten, **Then** `tooltip-wrapper.tsx` and the local theme are deleted and click-toggle in **both** directions, `ClickAwayListener` dismissal and close-on-breakpoint-change are preserved and still asserted (FR7).
- **Given** the existing specs, **When** they are updated to the new render path, **Then** every previously committed behavioural assertion still exists — `make test-unit-client` and `make test-integration` prove it and the integration layer stays at 100% (FR24, FR27).
- **And** no assertion is satisfied by inspecting the toolkit's exported styles instead of the app's rendered output (FR27).
- **Accessibility acceptance:** the trigger exposes `role="button"` with a non-empty accessible name; Enter and Space open it and Escape dismisses it, with focus remaining on (or returning to) the trigger; `aria-expanded` tracks the open state and `aria-controls` points at the rendered panel's id; the panel's content is announced on open; both the closed and open states scan clean at serious/critical **and** unset impact. Registration of these states in `src/test/a11y/interaction-states.ts` is Story 6.5.

## Epic 4 Stories: Adapters Preserving Accessibility and Security

Governing rule (AD-2): render the raw toolkit component and run the committed suites; a seam becomes an adapter **only** where an accessibility or security assertion goes red, and the failing spec is named in the seam's doc comment. An adapter may only preserve behaviour, never add it. The set is exactly three — `ui-link`, `ui-input`, `ui-button` — and a **fourth** adapter is a scope change (FR9); `ui-text-field-form` is a local composite over those seams, not an adapter, and does not count against the cap.

One edge in this epic runs backwards against the epic numbering and is stated here rather than left to be discovered: Story 4.2 depends on Story 6.1's shared i18n namespace. Story 6.1 is Independent and dispatchable in the first batch, so the graph, not the epic number, is the dispatch input.

### Story 4.1: `ui-link` adapter - case-folded `rel` hardening

**As an** end user following an external link, **I want** `rel` hardening that does not depend on the case of `target`, **so that** a `_BLANK` link cannot open a new tab with no `rel`.

**Implements:** FR9, FR12 (AD-3, NFR11) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-link/index.tsx`, `src/components/ui-link/types.ts`, `src/test/testing-library/UiLink.test.tsx`

- **Given** the adapter, **When** authored, **Then** it calls `resolveExternalLinkRel` from `src/shared/externalLinkRel.ts` — the single `rel` sink, unchanged — which case-folds `target` and **merges** caller-supplied `rel` tokens rather than replacing them (FR12).
- **Given** `target="_BLANK"`, **When** rendered, **Then** the anchor carries `noopener noreferrer`; `UiLink.test.tsx`'s "hardens a case-variant blank target" and `tests/integration/coverage/shared/external-link-rel.integration.test.ts` both pass **unmodified** (FR12, NFR11, FR27).
- **Given** `exactOptionalPropertyTypes`, **When** `target`/`rel` are forwarded, **Then** they are handed over by conditional spread, because the toolkit declares them without `| undefined` — proven by `make lint-tsc` with no `@ts-expect-error` anywhere (NFR17).
- **And** the seam's doc comment names the regression test that justifies the adapter and the upstream gap (1) that retires it (FR9).
- **And** `make lint-metrics` passes on the adapter file with `config/metrics-policy.json` unchanged; a complexity breach is reduced by refactoring the adapter, never by editing the policy or excluding the file (NFR4, NFR17).
- **Accessibility acceptance:** the anchor keeps `role="link"` and its accessible name; it stays in the tab order and is activated by Enter with a visible focus ring; no ARIA attribute is added or removed by the hardening path; the component scans clean at serious/critical and unset impact in both same-tab and new-tab configurations.

### Story 4.2: `ui-link` adapter - localized visually-hidden new-tab cue

**As a** Ukrainian-language screen-reader user, **I want** the new-tab cue in the language I am browsing in, **so that** I never hear an English phrase spliced into a Ukrainian link name.

**Implements:** FR14 (AD-3, NFR16) | **Marking:** Dependent (4.1 - same files; 6.1 - needs the shared namespace) | **Files:** `src/components/ui-link/index.tsx`, `src/components/ui-link/types.ts`, `src/test/testing-library/UiLink.test.tsx`

- **Given** the adapter, **When** the cue is resolved, **Then** it is `newTabLabel ?? (opensNewTab ? t('accessibility.opens_in_new_tab') : '')` over the same case-folded comparison, and the toolkit's hardcoded English default can never render (FR14, NFR16).
- **Given** both bundles, **When** the site runs with `NEXT_PUBLIC_MAIN_LANGUAGE=uk` and with `en`, **Then** the cue resolves through `t()` in each and assertions match the translated string, never a literal (NFR16).
- **Given** `target="_BLANK"`, **When** rendered, **Then** the link receives the hardened `rel` but **no** cue — the toolkit gates the cue on its own strict comparison — and that limitation is asserted in `ui-toolkit-adapters.integration.test.tsx` and recorded as upstream gap 1, not left implicit (FR14).
- **And** a caller-supplied `newTabLabel` still wins, and an explicitly empty label suppresses the cue.
- **Accessibility acceptance:** the cue is visually hidden but part of the link's accessible name (verified through the accessibility tree, not the DOM text); it does not alter the link's role or keyboard operability; the announced name reads naturally in both locales; every `_blank` link's name changes site-wide, which is why Story 6.4 repairs the name-based locators in the same change.

### Story 4.3: `ui-input` adapter - ARIA through `slotProps.htmlInput`, allow-listed prop surface

**As a** screen-reader user completing the registration form, **I want** the password requirements associated with the field itself, **so that** they are announced when I focus the input.

**Implements:** FR9, FR10, FR11 (AD-4, NFR12) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-input/index.tsx`, `src/components/ui-input/types.ts`

- **Given** the adapter, **When** authored, **Then** it keeps `buildInputSlotProps` and owns `slotProps` outright, so `aria-describedby` and `aria-required` land on the `<input>` rather than on the wrapping FormControl (FR10, NFR12).
- **Given** `UiInputProps`, **When** declared, **Then** it is an explicit `Pick` allow-list over `ComponentProps<typeof ToolkitUiInput>` plus `describedBy?` and `required?` — **not** `Omit<…>` over the whole of `TextFieldProps` — and the documented `name`/`autoComplete` rationale stays on the type (FR11).
- **Given** `required`, **When** set, **Then** the DOM carries `aria-required` and **never** the native `required` attribute; a regression here is what the narrow surface exists to prevent (FR11, NFR12).
- **And** `UiInput.test.tsx` and `UiTextFieldForm.test.tsx` pass with their assertions unchanged, not relaxed (FR27), and `UiTextFieldForm` is otherwise untouched — it merely re-composes the toolkit-backed seams as a local composite, which is why it is not a fourth adapter.
- **And** the seam's doc comment names the regression test that justifies the adapter (`UiInput.test.tsx`'s `aria-describedby` delivery case, plus `AuthForm`'s `password-requirements` association) and upstream gap 2 as the condition that retires it — the same doc-comment obligation Stories 4.1 and 4.4 carry (FR9, FR37).
- **And** `make lint-metrics` passes on the adapter file with `config/metrics-policy.json` unchanged; a complexity breach is reduced by refactoring the adapter, never by editing the policy or excluding the file (NFR4, NFR17).
- **Accessibility acceptance:** `AuthForm`'s `password-requirements` association survives end to end and is asserted at the `<input>`; the field keeps its programmatic label; error state exposes `aria-invalid` and the live-region error text still announces; focus order and visible focus are unchanged; `make test-a11y` reports 0 serious/critical and 0 unset-impact findings on the form route and on its validation-error interaction state.

### Story 4.4: `ui-button` adapter - falsy-`href` drop and `rel`/`target` prop declarations

**As a** developer, **I want** a falsy `href` to leave a `<button>` a button and `rel`/`target` to type-check, **so that** neither a destination-less anchor nor a `tsc` error reaches a call site.

**Implements:** FR9, FR13 (AD-5) | **Marking:** Dependent (1.1, 2.1) | **Files:** `src/components/ui-button/index.tsx`, `src/components/ui-button/types.ts`, `src/test/testing-library/UiButton.test.tsx`

- **Given** a falsy `href`, **When** the button renders, **Then** MUI receives no `href` and the element stays a `<button>` (FR13) — asserted in the client layer.
- **Given** `UiButtonProps`, **When** declared, **Then** it is `ComponentProps<typeof ToolkitUiButton> & { rel?: string; target?: string; href?: string }` and `rel`/`target`/`href` are rebuilt by conditional spread for `exactOptionalPropertyTypes`; no `@ts-expect-error` or declaration merging is used (FR13, NFR17).
- **And** the seam's doc comment names upstream gap 2 as the condition that retires it (FR9, FR37).
- **And** `make lint-metrics` passes on the adapter file with `config/metrics-policy.json` unchanged; a complexity breach is reduced by refactoring the adapter, never by editing the policy or excluding the file (NFR4, NFR17).
- **Accessibility acceptance:** the element's role follows its semantics — `button` when there is no destination, `link` when there is — so keyboard behaviour (Space and Enter for a button, Enter for a link) matches what is announced; the accessible name and focus ring are unchanged; a destination-less anchor, which is unfocusable and unannounced as a control, can no longer be produced.

## Epic 5 Stories: Font Pipeline

### Story 5.1: Declare the real-named faces and the metric-adjusted fallbacks in `styles/global.css`

**As an** end user, **I want** the site's own `.woff2` faces declared under the families the toolkit actually names, **so that** every toolkit component renders in the intended typeface at no added payload.

**Implements:** FR15, FR17, FR18 (AD-7, NFR9, NFR10) | **Marking:** Independent | **Files:** `styles/global.css`

- **Given** `styles/global.css`, **When** the faces are declared, **Then** nine `@font-face` rules name `Inter` (400/500/700) and `Golos Text` (400/500/600/700/800/900) against the **already committed** `.woff2` assets (472,032 B total), each with `font-display: swap` (FR15, NFR10).
- **Given** the payload requirement, **When** the mechanism is chosen, **Then** `@vilnacrm/ui-toolkit/styles.css` is **not** imported — it ships `.ttf` totalling 1,348,788 B against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger) — and added font payload is 0 B, proven by `make lighthouse-desktop` and `make lighthouse-mobile` at the unchanged 85/40 floors (FR17, NFR5, NFR9).
- **Given** the two fallback faces over `local('Arial')`, **When** their `size-adjust`/`ascent-override`/`descent-override`/`line-gap-override` are written, **Then** the comment above them records the **recompute rule** — `size-adjust` is the ratio of the fallback's to the real face's frequency-weighted average lowercase advance width, and the ascent/descent/line-gap overrides are the face's own metrics divided by `unitsPerEm` and then by that `size-adjust`, computed from the committed `-Regular.woff2` — and states that replacing a family's regular face requires recomputation in the same commit (FR18).
- **And** the emitted faces land under `out/_next/static/media/`, which `scripts/cloudfront_routing.js` already allows, so `scripts/ci/verify-edge-allowlist.mjs` passes with **no** widening; needing to widen it would be a defect, not a gate change (NFR17).
- **Accessibility acceptance:** `font-display: swap` guarantees text is never invisible while a face loads (no FOIT); the metric-adjusted fallbacks keep layout shift inside the existing CLS assertions, so content does not move under a user who is mid-read — but the **authoritative** discriminator for whether those metrics are right is Story 8.1's Build B recompute from the committed `-Regular.woff2`, not a CLS number: lab CLS on this repository's mobile lane is a known-unstable measurement and is corroborating evidence in both directions only (FR18, NFR10); no rendered text's contrast changes, because only the face — not any colour token — moves.

### Story 5.2: Drop `next/font/local` and route the app's own typeface through a class

**As a** contributor, **I want** the generated per-import family names gone, **so that** there is exactly one font mechanism and no page depends on an opaque hash.

**Implements:** FR16 (AD-7) | **Marking:** Dependent (5.1) | **Files:** `src/config/Fonts/{inter,golos}.ts` (deleted), `src/config/Fonts/families.ts` (new), `pages/_app.tsx`, `src/features/landing/components/for-who-section/cards/styles.ts`, `src/features/landing/components/notification/styles.success.ts`

- **Given** the deletions, **When** `next/font/local` is dropped for these two families, **Then** no page, component or stylesheet references a `next/font`-generated class or family name anywhere in the tree (FR16) — grep-verifiable and checked by `make lint-next` (`no-orphans` via `make lint-deps` for the deleted modules).
- **Given** `pages/_app.tsx`, **When** updated, **Then** `<main className="app-typeface">` replaces the generated class and `.app-typeface` resolves to `'Golos Text', 'Golos Text Fallback', sans-serif` (FR16).
- **Given** `src/config/Fonts/families.ts`, **When** added, **Then** it exports `GOLOS_TEXT_FAMILY`, has a real importer in the landing styles modules (NFR15), and the two landing style files consume it rather than restating a literal.
- **Accessibility acceptance:** the visual typeface, weight and size of every rendered string are unchanged in intent, so text contrast and readable size are preserved; the change is class-name-only and adds, removes or alters no role, name, focus behaviour or announcement anywhere.

### Story 5.3: Rewrite `_fonts.scss` onto real family names

**As an** integrator reading `/swagger`, **I want** the SCSS font variables to name families a browser can resolve, **so that** the page's typography no longer rests on a hand-copied hash nothing re-derives.

**Implements:** FR19 (AD-7) | **Marking:** Dependent (5.1) | **Files:** `src/features/swagger/components/api-documentation/global/variables/fonts/_fonts.scss`

- **Given** `_fonts.scss`, **When** rewritten, **Then** `$golos: 'Golos Text', sans-serif` and `$inter: 'Inter', sans-serif` replace the hardcoded `__golos_58e94b` / `__inter_74e140` generated names, and no generated hash remains in the file (FR19).
- **Given** `_ui-typography.scss` and `styles.scss`, **When** they consume those variables, **Then** `/swagger` renders the declared faces from Story 5.1 (FR19) — the evidence for whether `main` was already falling back is produced by Story 8.1's Build A, not asserted here.
- **And** `make lint-next`, `make build-out` and `make storybook-build` complete without a font resolution warning.
- **Accessibility acceptance:** `/swagger`'s text keeps its contrast and its readable size at every breakpoint; the axe route scan for `/swagger` (`src/test/a11y/routes.ts`) and the expanded-operation and authorize-dialog interaction states stay clean at serious/critical and unset impact.

## Epic 6 Stories: Tests, Storybook Stories and Shared i18n

### Story 6.1: Add the shared i18n namespace and teach the generator to merge it last

**As a** contributor, **I want** the shared primitives' strings in a shared namespace the generator understands, **so that** a shared component never reads a feature's bundle.

**Implements:** FR28 (AD-6, NFR16) | **Marking:** Independent | **Files:** `src/shared/i18n/{en,uk}.json` (new), `scripts/localizationGenerator.js`, `scripts/localizationGenerator.d.ts`, `src/test/unit/localization-generator.test.ts`, `src/features/landing/i18n/{en,uk}.json`

- **Given** `src/shared/i18n/{en,uk}.json`, **When** added, **Then** they hold the `accessibility.*` namespace including `opens_in_new_tab` in both locales, and the key is **removed** from `src/features/landing/i18n/{en,uk}.json` (FR28, NFR16).
- **Given** `LocalizationGenerator`, **When** extended, **Then** it merges an ordered list of roots with `src/shared/i18n` **last**, so a shared key can never be shadowed by a colliding feature key, and each root's listing stays sorted for deterministic merges (FR28).
- **Given** the generator spec, **When** it runs, **Then** it gains a **shadowing** case proving a colliding feature key loses to the shared one, and `scripts/localizationGenerator.d.ts` is updated in the same change (FR28).
- **Given** the four independent regeneration paths for the gitignored `pages/i18n/localization.json` — Jest's `globalSetup`, the `lint` / `lint-deps` prerequisite, the `start-prod` recipe, and Stryker's `ignorePatterns` — **When** the generator gains a root, **Then** each path is exercised and produces a bundle carrying the shared `accessibility.*` keys. This repository has already shipped a cascade where one of those paths was updated and the others were not, so "the existing hooks regenerate it" is asserted here rather than assumed (FR28).
- **And** `pages/i18n/localization.json` stays gitignored and is regenerated by the existing hooks; `make lint-deps` reports no new boundary violation (NFR14).

### Story 6.2: Fix the `UiCheckBox` hover-token assertion by reading the CSSOM

**As a** CI maintainer, **I want** the one failing Jest case fixed at its root cause, **so that** `unit`, `smoke` and `codecov` go green without any assertion being weakened.

**Implements:** FR24, FR27 (AD-12, NFR17) | **Marking:** Dependent (3.3 - same file) | **Files:** `src/test/testing-library/UiCheckBox.test.tsx`

- **Given** the root cause, **When** the fix is written, **Then** it addresses Emotion's *speedy* insertion (`CSSStyleSheet.insertRule()` under `NODE_ENV=production`, which `make` exports via `.env.production`), where the `<style>` element has no child text node and `style.textContent` is `''` (AD-12).
- **Given** the replacement, **When** authored, **Then** it reads `document.styleSheets` → `cssRules` → `cssText` and asserts some rule carries `:hover`, `.ui-checkbox-box` and the border-colour token — populated under **both** insertion modes — and the latent `.split('}')` mis-split on at-rule-nested rules is gone (AD-12).
- **Given** NFR17, **When** the fix lands, **Then** the assertion is not deleted, skipped, made conditional, satisfied against the toolkit's exported style object, or worked around by forcing `NODE_ENV !== 'production'` (FR27).
- **And** the assertion stays in the client jsdom layer (`make test-unit-client`); no 235th Playwright baseline is added; 1003 of 1003 cases pass and `codecov` clears downstream (FR24).
- **Accessibility acceptance:** the hover affordance the token expresses is a visual enhancement only — the assertion guards that it did not silently disappear across the rendering-path change; the checkbox's focus-visible indicator and its contrast are separately asserted by Story 3.3 and are unaffected by this fix.

### Story 6.3: Drive every adapter branch at the integration layer and hold the coverage floors

**As a** reviewer, **I want** each adapter branch exercised where coverage is absolute, **so that** "the behaviour is preserved" is measured rather than claimed.

**Implements:** FR24, FR25, FR26 (NFR1) | **Marking:** Dependent (4.1, 4.2, 4.3, 4.4) | **Files:** `tests/integration/coverage/misc-small/ui-toolkit-adapters.integration.test.tsx`

- **Given** `ui-link`, **When** the cases run, **Then** the lower-case `_blank`, case-variant `_BLANK`, caller-`rel`-merge, explicitly-empty-label, same-tab and caller-supplied-label paths are all driven (FR25).
- **Given** `ui-button`, **When** the cases run, **Then** the rel+target, neither, and empty-`href`-stays-a-button paths are driven (FR25).
- **Given** this layer's 100% verdict, **When** it is read, **Then** it is read for `src/**` only: `INTEGRATION_COVERAGE_FROM` is `src/**` plus exclusions, so a `scripts/`-rooted module is never collected here and no claim about `scripts/verifyUiToolkit.mjs` may rest on this story. That verifier's coverage belongs to Story 1.2, in the client layer, under a per-file 100% group (FR26).
- **And** `make test-integration` reports **100%** statements / branches / functions / lines, and `make test-unit-client` and `make test-unit-edge` hold their floors (client >= 92/95/97/97 globally, plus Story 1.2's per-file 100% group; edge 100% per file) with no threshold edited or lowered (FR24, FR26, NFR17).

### Story 6.4: Repair every name-based locator the new-tab cue changes

**As a** developer, **I want** the locator sweep to land with the cue, **so that** no suite fails days later on a name that changed site-wide.

**Implements:** FR29 (NFR16) | **Marking:** Dependent (4.2, 6.1, 6.5 — `src/test/a11y/interaction-states.ts` is Story 6.5's file and 6.5 must land first) | **Files:** `src/test/testing-library/AuthFormPolicyLinks.test.tsx`, `src/test/e2e/register-form/constants.ts`, `src/test/a11y/routes.ts`, and the locators inside `src/test/a11y/interaction-states.ts` that match a link or label name

- **Given** every `_blank` link, **When** its accessible name gains the cue, **Then** every name-based locator matching a link or label name is updated in the same change — client, e2e, a11y route sweep and interaction states (FR29).
- **Given** each updated locator, **When** it asserts a name, **Then** it matches the **translated** string via `t()`, never a hardcoded English literal (NFR16).
- **Given** `src/test/a11y/interaction-states.ts`, **When** this story edits it, **Then** it edits only the **locators** inside entries Story 6.5 has already registered — 6.5 owns the registry entries themselves — which is why 6.5 is a declared dependency rather than a parallel peer: two agents editing one registry file is a merge conflict, not a parallel batch (repo rule: touching the same file as another story is sufficient to mark a story Dependent).
- **And** `make test-unit-client`, `make test-e2e` and `make test-a11y` pass, and no locator is repaired by falling back to `data-testid` (repo selector policy).
- **Accessibility acceptance:** the sweep is itself the accessibility evidence — each repaired locator asserts the *accessible name* an assistive-technology user hears, so a regression in the announced name fails a test rather than passing silently.

### Story 6.5: Register and drive the tooltip's new keyboard interaction states

**As a** keyboard and screen-reader user, **I want** the tooltip's open and dismissed states scanned by axe, **so that** the states a route scan never sees are still conformant.

**Implements:** FR7, NFR6, NFR7 | **Marking:** Dependent (3.4) | **Files:** `src/test/a11y/interaction-states.ts`, `src/test/e2e/tooltip.spec.ts`

- **Given** `src/test/a11y/interaction-states.ts`, **When** updated, **Then** it registers the trigger-focused, expanded-via-Enter/Space and dismissed-via-Escape states (NFR7).
- **Given** `src/test/e2e/tooltip.spec.ts`, **When** it drives those states, **Then** it calls `scanInteractionState` for each; the registry's drift guard parses the specs with the TypeScript AST and counts only an executable call, so a registered-but-unscanned state fails — satisfied by adding the scan, **never** by editing the guard (NFR7, NFR17).
- **And** `make test-a11y` and `make test-e2e` report 0 serious/critical and 0 unset-impact violations in every registered state (NFR6).
- **Accessibility acceptance:** in the expanded state the trigger reports `role="button"` with `aria-expanded="true"` and `aria-controls` resolving to the rendered panel; Enter and Space open and Escape dismisses; focus stays on or returns to the trigger on dismissal and remains visible; the panel's text is announced on open; moderate and minor findings are attached to the report rather than gating.

### Story 6.6: Rewrite the six Storybook stories and make Storybook render production's stylesheet

**As a** designer reviewing the design surface, **I want** the stories back and rendering the production faces, **so that** Storybook stops drifting from what ships.

**Implements:** FR20, FR30 (AD-13) | **Marking:** Dependent (3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.4, 5.1) | **Files:** `.storybook/preview.ts`, `.storybook/main.ts`, `src/components/ui-button/button.stories.tsx`, `src/components/ui-checkbox/checkbox.stories.tsx`, `src/components/ui-link/link.stories.tsx`, `src/components/ui-toolbar/toolbar.stories.tsx`, `src/components/ui-tooltip/tooltip.stories.tsx`, `src/components/ui-typography/typography.stories.tsx`

- **Given** the six deleted story files, **When** they are rewritten, **Then** each imports from `@/components` (never the toolkit directly), so the stories exercise what actually ships (FR30).
- **Given** `.storybook/preview.ts`, **When** updated, **Then** it imports `../styles/global.css`, so every toolkit component renders in the same faces production uses (FR20).
- **Given** `.storybook/main.ts`, **When** updated, **Then** the now-dead `staticDirs` font block is removed, since the mechanism it served no longer exists (FR20).
- **And** `make storybook-build` succeeds and no gate was relied on to notice the deletion — none exists; `scripts/ci/mutation-scope.ts` only *excludes* `*.stories.tsx` (FR30).
- **Accessibility acceptance:** each rewritten story renders the states a reviewer must judge — default, hover, focus-visible, disabled and, for the checkbox, error/`aria-invalid` — so the focus indicator and token contrast are visible in the design surface rather than only in a spec.

## Epic 7 Stories: Static-JS Byte Budget

### Story 7.1: Produce the directed bundle diff against `main`

**As a** CI maintainer, **I want** the analyzer diff before any trimming, **so that** the 36,275 B is attributed to named chunks rather than guessed at.

**Implements:** FR32 (AD-10) | **Marking:** Dependent (Epics 3, 4, 5 complete) | **Files:** none committed - `make build-analyze` reports plus the change record in this spec bundle

- **Given** both sides, **When** measured, **Then** `make build-analyze` runs on `origin/main` and on the branch, both reports are kept, and the gate's own arithmetic is reproduced per file (`find out/_next/static -type f -name '*.js' -printf '%s\n'`) so the delta is attributable to chunks, not to a total (FR32).
- **Given** the PRD's first suspect, **When** re-checked, **Then** it is recorded as already ruled out by measurement: after the change no `src/components/ui-*/index.*` imports `@mui/material` (AD-10).
- **Given** hypothesis A, **When** tested, **Then** the report is checked for `@vilnacrm/ui-toolkit` appearing inside two or more page chunks — the gate sums **every** file, so a 275.7 KB module emitted twice counts twice (AD-10).
- **And** hypothesis B is tested by searching the emitted chunk for a symbol this site never renders (`UiPinInput`, `UiTaskCard`), evidencing failed tree-shaking (AD-10).

### Story 7.2: Close the gap by a bundler change, or declare the change not shippable

**As a** CI maintainer, **I want** the budget met by trimming payload or the change stopped, **so that** the number in `validate-build-artifact.sh` is the number it always was.

**Implements:** FR31, FR33 (AD-10, NFR8, NFR17) | **Marking:** Dependent (7.1) | **Files:** `next.config.js` (only if hypothesis A holds)

- **Given** hypothesis A confirmed, **When** the fix is applied, **Then** a `splitChunks` cache group in `next.config.js` hoists the toolkit into one shared chunk — a bundler configuration change, not a budget change (FR31).
- **Given** the gate, **When** it runs, **Then** `scripts/ci/validate-build-artifact.sh` measures <= 3,300,000 B and the `build-artifact` check is green (FR31, NFR8).
- **Given** neither step closes 36,275 B, **When** the outcome is recorded, **Then** the change is declared **not shippable in this form** pending upstream per-component entry points (`@vilnacrm/ui-toolkit/ui-button`) — and shipping 1.10% over is not an available outcome (FR33).
- **Given** the not-shippable branch, **When** it is taken, **Then** the per-component entry-point request is filed as **upstream gap 7** in Story 9.2's set before the branch is closed out, so the prerequisite this fallback depends on has an owner rather than being a hope (FR33, FR37).
- **Given** the not-shippable branch, **When** the remaining work is dispositioned, **Then** it is recorded explicitly and not left to a dispatcher to infer: **Epic 8 is suspended, not skipped** — Story 8.1 is measured over the tree this story produces, so with no byte fix there is no tree to isolate against; no PNG is regenerated and no `make test-visual-update` runs (FR34, NFR17). **Epic 9 runs in full** — 9.1's documentation sync and 9.2's seven gap filings are what preserve the work. And **PR #459 is converted to draft** rather than merged or closed, so the seam, digest, adapter and font work is re-entered when an upstream release carrying per-component entry points lands (FR33).
- **And** none of the following is done under any reading: raising `js_budget`, excluding a chunk from the sum, or splitting a chunk purely to game a sum that is taken over all files (NFR17).

## Epic 8 Stories: Visual-Baseline Isolation and Review

### Story 8.1: Run the three-build isolation experiment before touching a PNG

**As** the CODEOWNERS owner of the snapshots, **I want** the two candidate causes separated mechanically, **so that** I can tell a recorded fix from a certified bug.

**Implements:** FR35 (AD-11, NFR17) | **Marking:** Dependent (5.1, 5.2, 5.3, 7.2) | **Files:** none committed - three `make test-visual` runs plus the recorded findings in this spec bundle

- **Given** Build M (`origin/main`), **When** it runs, **Then** the committed baselines still reproduce, excluding a machine or browser difference before anything is attributed to this change (FR35).
- **Given** Build A (branch HEAD with `_fonts.scss` reverted to the generated names), **When** it runs, **Then** swagger screenshots **matching** the committed baselines prove the hashes were stale on `main` and the branch's swagger movement is an intended fix; screenshots **differing** prove the hashes were live and the movement must be explained before acceptance (FR35).
- **Given** Build B (branch HEAD as-is), **When** the landing set is judged, **Then** the four override values are **recomputed** per Story 5.1's rule from the committed `-Regular.woff2`; values differing from the committed ones are a **bug to fix**, never a baseline (FR18, FR35).
- **And** no `make test-visual-update` is run and no `maxDiffPixels`/`threshold` is added to `playwright.config.ts` before this story completes (FR34, NFR17).
- **Accessibility acceptance:** the 21 px height change on `uk_largeMobile` (414x1562 to 414x1541) is treated as a possible layout defect until proven a metric correction — a wrongly baselined shift is a reflow that moves content under a low-vision or zoomed user, which is exactly what a self-certifying baseline would hide.

### Story 8.2: Regenerate only with a written cause, and only in the `uk` lane

**As** a reviewer, **I want** every regenerated PNG to carry its cause, **so that** the baseline stops certifying itself.

**Implements:** FR34, FR36 (AD-11, NFR17) | **Marking:** Dependent (8.1) | **Files:** `src/test/visual/**/*-snapshots/` (uk lane only)

- **Given** each regenerated PNG, **When** it is committed, **Then** the change record states its cause in Story 8.1's vocabulary — "swagger now renders real Golos Text (stale hash on `main`)", "fallback metrics recomputed", or "real-face metrics differ from the generated fallback" — plus the build that proved it (FR36).
- **Given** CODEOWNERS, **When** the snapshots change, **Then** `/src/test/visual/*-snapshots/` and `/src/test/visual/**/*-snapshots/` are reviewed by their owner before merge (FR34, issue #344).
- **Given** `NEXT_PUBLIC_MAIN_LANGUAGE=uk`, **When** the lane is scoped, **Then** only the `uk` set is regenerated; the `en` baselines did not execute, did not move, and must not be touched (FR36).
- **And** `make test-visual` is green afterwards with 0 diffs and no relaxation of any Playwright comparison option (NFR3, NFR17).
- **Accessibility acceptance:** a regeneration is accepted only where the recorded cause is a typeface rendering as intended; any movement attributable to layout is fixed in code first, so no baseline can bless a reflow, a clipped control or a shrunken hit target.

## Epic 9 Stories: Documentation Sync and Upstream Gap Filing

### Story 9.1: Sync the agent and contributor docs to the seam, the digest gate and the font pipeline

**As a** contributor, **I want** the repository's own docs to describe the new seam, gate and font mechanism, **so that** the next change does not rediscover them from a PR body.

**Implements:** documentation-sync obligation for FR1-FR3, FR15-FR20 | **Marking:** Dependent (1.3, 5.1, 5.2, 5.3, 6.6) | **Files:** `CLAUDE.md`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `src/components/README.md` if present

- **Given** the new gate, **When** documented, **Then** `make lint-ui-toolkit` and `make update-ui-toolkit` are described with their hermetic/networked split and their place in `make lint` and `CI_LINT_TARGETS` (FR3).
- **Given** the seam, **When** documented, **Then** AD-2's rule is written down — an adapter exists only where a committed assertion fails, and each names its regression test and its retiring upstream gap (FR9).
- **Given** the font pipeline, **When** documented, **Then** the docs state that `styles/global.css` is the single font mechanism, that the toolkit's `styles.css` is rejected on payload grounds, and that the fallback overrides carry a recompute rule (FR15-FR19).
- **And** `make lint` and `make ci-lint` are green with `lint-ui-toolkit` included in both aggregates. This is the whole-aggregate half of the issue's AC5 ("`make lint` and every Jest layer pass") — every other story names only its own sub-gate, and the aggregate itself newly gains a target in Story 1.3, so it is asserted once here, in the last story in the graph (AC5, FR3, NFR3).
- **And** the docs never repeat `CONSUMING.md`'s claim that the lockfile hash makes the pin tamper-evident, because it is false for a remote-tarball entry (FR4); `make lint-md` and `make format` pass.

### Story 9.2: File the seven upstream gaps and cite each from the adapter it keeps alive

**As a** maintainer, **I want** each adapter to name the upstream defect that retires it, **so that** the remaining local code is debt with a payoff rather than preference.

**Implements:** FR37 (AC8) | **Marking:** Dependent (4.1, 4.2, 4.3, 4.4) | **Files:** `src/components/ui-link/index.tsx`, `src/components/ui-input/index.tsx`, `src/components/ui-button/index.tsx` (doc comments only), plus GitHub issues on `VilnaCRM-Org/ui-toolkit`

- **Given** the seven gaps, **When** filed, **Then** each is a separate upstream issue: (1) case-sensitive `rel` hardening — a security defect that also suppresses the `_BLANK` cue; (2) `Ui*Props` not exported (`ae-forgotten-export`); (3) hardcoded, non-tokenized font families; (4) English-defaulted `newTabLabel`; (5) optional props omitting `| undefined`; (6) three bare `fontFamily:"Golos"` references with no matching `@font-face`; (7) **no per-component entry points** — `build/index.mjs` is one 275.7 KB ESM module whose components share theme objects, so bundle cost scales with the whole package rather than with what is consumed (FR37).
- **Given** gap 7, **When** it is filed, **Then** it is recorded as retiring **no adapter** — it is the prerequisite Story 7.2's not-shippable branch waits on — and it is filed on **both** branches, so a shippable outcome still leaves the request on record and a not-shippable outcome is never blocked on an unfiled prerequisite (FR33, FR37).
- **Given** each adapter, **When** its doc comment is written, **Then** it links the gap that retires it and the committed regression test that must stay green through the retiring commit (FR9, FR37).
- **And** the retirement conditions are stated: gap 1 retires `resolveExternalLinkRel` *and* restores the `_BLANK` cue; gap 2 lets `ui-button`'s intersection and `ui-input`'s `Pick` derive from an exported interface; gap 4 leaves the localization in place but no longer as a suppression.

## Story Dependency Graph

```text
LAYER 0 - dispatch immediately, no prerequisites
  1.1 pin + UI_TOOLKIT_VERSION        2.1 jest/stryker resolution (both configs + parity spec)
  5.1 global.css faces + fallbacks    6.1 shared i18n namespace + generator

LAYER 1
  1.2 digests + offline verifier .......... 1.1, 2.1 (shares jest.config.ts)
  5.2 drop next/font, families.ts ......... 5.1
  5.3 _fonts.scss real families ........... 5.1
  3.1 ui-color-theme + ui-breakpoints ..... 1.1, 2.1
  3.2 ui-typography + ui-toolbar ........... 1.1, 2.1
  3.3 ui-checkbox .......................... 1.1, 2.1
  3.4 ui-tooltip ........................... 1.1, 2.1
  4.1 ui-link rel hardening ................ 1.1, 2.1
  4.3 ui-input slotProps + Pick ............ 1.1, 2.1
  4.4 ui-button falsy-href + prop types .... 1.1, 2.1
     (3.1 3.2 3.3 3.4 4.1 4.3 4.4 touch disjoint files - dispatch all seven in parallel)

LAYER 2
  1.3 make targets + Dockerfile + bats .... 1.2
  4.2 localized new-tab cue ............... 4.1 (same files), 6.1 (namespace)
  6.2 UiCheckBox CSSOM hover assertion .... 3.3 (same file)   >>> unblocks unit/smoke/codecov
  6.5 tooltip a11y interaction states ..... 3.4

LAYER 3
  6.4 locator sweep ....................... 4.2, 6.1, 6.5 (same file: a11y/interaction-states.ts)
  6.3 adapter integration coverage 100% ... 4.1, 4.2, 4.3, 4.4
  6.6 storybook rewrite + preview.ts ...... 3.1-3.4, 4.1, 4.2, 4.4, 5.1
  9.2 upstream gaps + adapter comments .... 4.1, 4.2, 4.3, 4.4

LAYER 4 - measured over a complete tree
  7.1 build-analyze diff .................. all of Epics 3, 4, 5
  7.2 close the budget or stop ............ 7.1                >>> unblocks build-artifact

LAYER 5 - measured over the final tree, including any chunk split from 7.2
         (reached only if 7.2 closed the budget; on FR33's not-shippable
          verdict Epic 8 is SUSPENDED, not skipped - see Story 7.2)
  8.1 three-build isolation experiment .... 5.1, 5.2, 5.3, 7.2
  8.2 regenerate with a recorded cause .... 8.1                >>> unblocks visual-test

LAYER 6
  9.1 documentation sync .................. 1.3, 5.1, 5.2, 5.3, 6.6
```

**Independent (4):** 1.1, 2.1, 5.1, 6.1. **Dependent (23):** everything else. Seven Layer-1 stories (3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 4.4) touch disjoint files and are the widest parallel batch; 5.2 and 5.3 are a second parallel pair once 5.1 lands.

## FR Coverage Map

Every FR1-FR37 is claimed by at least one story. No FR is left uncovered.

| FR | Subject | Epic | Story |
| --- | --- | --- | --- |
| FR1 | one immutable release-tarball pin | 1 | 1.1 |
| FR2 | single `UI_TOOLKIT_VERSION` source of truth | 1 | 1.1 |
| FR3 | committed SHA-256, verified before use | 1 | 1.2, 1.3 |
| FR4 | offline verification, no trust in `bun.lock` | 1 | 1.2, 1.3 |
| FR5 | six same-path re-export seams | 3 | 3.1, 3.2, 3.3, 3.4 |
| FR6 | seam holds at the path level (28 + 22 deep imports) | 3 | 3.1 |
| FR7 | `ui-tooltip` retires the wrapper, gains keyboard | 3 | 3.4 |
| FR8 | `ui-checkbox` on MUI's control, tokens preserved | 3 | 3.3 |
| FR9 | adapter only where an assertion fails; exactly three | 4 | 4.1, 4.3, 4.4 |
| FR10 | `buildInputSlotProps` puts ARIA on the `<input>` | 4 | 4.3 |
| FR11 | `UiInputProps` stays an explicit allow-list | 4 | 4.3 |
| FR12 | case-folded `rel` hardening, merged tokens | 4 | 4.1 |
| FR13 | falsy-`href` drop + `rel`/`target` prop types | 4 | 4.4 |
| FR14 | localized cue, `_BLANK` limitation asserted | 4 | 4.2 |
| FR15 | real-named `@font-face` over the committed `.woff2` | 5 | 5.1 |
| FR16 | `next/font/local` dropped for both families | 5 | 5.2 |
| FR17 | toolkit `styles.css` rejected; zero added payload | 5 | 5.1 |
| FR18 | fallback overrides are derived data with a rule | 5 | 5.1 (recomputed in 8.1) |
| FR19 | `_fonts.scss` names real families | 5 | 5.3 |
| FR20 | Storybook imports the production stylesheet | 6 | 6.6 |
| FR21 | `jest.config.ts` maps the ESM-only package | 2 | 2.1 |
| FR22 | `jest.mutation.config.ts` carries the same map | 2 | 2.1 |
| FR23 | shared ESM allow-list; divergence is a defect | 2 | 2.1 |
| FR24 | every Jest layer passes; integration at 100% | 6 | 6.2, 6.3 |
| FR25 | every adapter branch driven at integration | 6 | 6.3 |
| FR26 | client and edge layers hold their floors; verifier at 100% per file | 6, 1 | 6.3, 1.2 |
| FR27 | no a11y or security assertion deleted | 3, 4, 6 | 3.2, 3.3, 3.4, 4.1, 4.3, 6.2 |
| FR28 | new-tab key in a shared namespace | 6 | 6.1 |
| FR29 | name-based locator sweep in the same change | 6 | 6.4 |
| FR30 | the six stories rewritten, not deleted | 6 | 6.6 |
| FR31 | measured static JS <= 3,300,000 B | 7 | 7.2 |
| FR32 | `make build-analyze` diff as the first artifact | 7 | 7.1 |
| FR33 | not shippable in this form if no trim closes it, with a stated exit | 7 | 7.2 |
| FR34 | no baseline regenerated before its cause is known | 8 | 8.1, 8.2 |
| FR35 | three-build isolation separates the two causes | 8 | 8.1 |
| FR36 | one written cause per PNG; `uk` lane only | 8 | 8.2 |
| FR37 | seven upstream gaps filed with retiring conditions | 9 | 9.2 |

NFR coverage is carried inside the stories rather than in a second table: NFR1/NFR3 in 6.3, NFR2 in 2.1, NFR4 across every seam and adapter story (`make lint-metrics` thresholds unchanged), NFR5/NFR9/NFR10 in 5.1, NFR6/NFR7 in 6.5 and the per-story accessibility criteria, NFR8 in 7.2, NFR11 in 4.1, NFR12 in 4.3, NFR13 in 1.2, NFR14/NFR15 in 3.1 and 5.2, NFR16 in 4.2 and 6.1, and NFR17 in every story that touches a gate.

## Open Questions

Every question this breakdown raised is closed below. None is left for implementation to decide.

> Assumption: the epic order follows what each epic unblocks, not the decision register's order. Jest/Stryker resolution is promoted to Epic 2 because no later epic's proof can run before it; the three red-check epics are ordered `unit` (6.2) then `build-artifact` (7.2) then `visual-test` (8.2), because bytes are measured over a build that must first test clean and pixels are measured over the tree the byte fix produces.

> Assumption: Story 4.2 depends on Story 6.1 across epic boundaries and this is left as a real edge rather than resolved by moving the i18n story into Epic 4. The graph, not the epic number, is the parallel-dispatch input, and 6.1 is Independent, so it can be dispatched in the first batch.

> Assumption: "touches the same file as another story" is sufficient to mark a story Dependent even where the two changes would not textually conflict. 6.2 depends on 3.3, 4.2 depends on 4.1, and 6.4 depends on 6.5 for exactly this reason — the last because both would otherwise edit `src/test/a11y/interaction-states.ts`, 6.5 adding the registry entries and 6.4 repairing the locators inside them. Treating any of them as parallel is how two agents produce a merge conflict in the same file, and the layer numbering that happens to serialise 6.5 before 6.4 is not a declared dependency a dispatcher would read.

> Assumption: AD-2's adapter rule is an epic-level governing rule with an acceptance criterion in each adapter story, not a story of its own. It produces no file; giving it a story would create a deliverable with nothing to verify.

> Assumption: `scripts/verifyUiToolkit.mjs` is covered in exactly **one** layer — the client layer, owned by Story 1.2 — and nowhere else. That is the layer `src/test/unit/contracts/check-api-versions.test.ts` already uses for a `scripts/`-rooted module, because the client layer keeps Jest's default imported-file coverage scope. The integration layer cannot hold it: `INTEGRATION_COVERAGE_FROM` is `src/**` plus exclusions, so the module is never collected and that layer's 100% verdict would be silent about it. The `edge` layer must not hold it: its 100%-per-file list is the two CloudFront handlers and the service worker — code that actually ships. And the client layer's floors are global, so they too would pass with the verifier entirely uncovered; the coverage is therefore made falsifiable by a per-file `coverageThreshold` group at 100%, which fails on an uncovered branch and fails again, with `Jest: Coverage data for … was not found.`, on a module the run never loaded.

> Assumption: Stories 7.1 and 8.1 are stories even though they commit no source file. Each produces a required, reviewable artifact — a bundle diff and a three-build finding — that FR32 and FR35 make a precondition of the story after it; dropping them would leave the byte trim and the baseline update unjustified, which is the failure mode both requirements exist to prevent.

> Assumption: Storybook stories count as user-facing for the accessibility-criteria rule. They are the surface a designer reviews states on, so 6.6 carries state-coverage criteria (focus-visible, disabled, error) rather than only build success.

> Assumption: the `en` visual lane is out of scope for regeneration. `NEXT_PUBLIC_MAIN_LANGUAGE=uk` means the `en` baselines did not execute and did not move; regenerating them would create diffs no run produced.

> Assumption: FR26's client and edge floors are claimed by Story 6.3 rather than by a story of their own. They are a property of the whole change measured in one place, and a dedicated story would have no files to touch.

> Assumption: no story may satisfy its gate by editing the gate. Where a story's acceptance criterion names a threshold, budget, allow-list, baseline or suppression, the criterion is that the value is **unchanged** — NFR17 restated per story, because a red gate on a retrospective plan is precisely where the temptation lands.

> Assumption: this breakdown targets toolkit `v0.3.0` as published, with the single exception FR33 already names — if Story 7.2 cannot close the byte gap, per-component entry points become a prerequisite and the change waits rather than shipping 1.10% over.

> Assumption: the adapter set is **three** and Story 4.3's `ui-text-field-form` clause is a scope exclusion,
> not a fourth adapter. The upstream brief's Proposed Solution table has four rows because its fourth records
> a local composite; the brief's own scope table, and AD-2's mechanical rule, both yield three. FR9's cap is
> therefore "a fourth adapter is a scope change" — a cap that admitted a fourth without one capped nothing.

> Assumption: Story 6.4 is Dependent on Story 6.5, rather than the two splitting ownership of
> `src/test/a11y/interaction-states.ts`. Splitting would need 6.5 to own cue-aware locators it cannot write
> before Story 4.2 lands, which trades one false marking for a second one; the declared edge is the honest
> shape, and it costs nothing because the layer ordering already implies it.

> Assumption: FR33's not-shippable branch has an explicit exit — gap 7 filed, Epic 8 suspended rather than
> skipped, Epic 9 run in full, PR #459 to draft — recorded on Story 7.2 rather than left to whoever reads the
> red check. A fallback whose downstream stories simply stop being mentioned is how a branch gets abandoned
> instead of parked.
