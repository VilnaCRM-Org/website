---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - ./research-458-ui-toolkit-primitives-2026-09-09.md
  - ./brief-458-ui-toolkit-primitives-2026-09-09.md
  - .claude/react-sdlc.yml
  - CLAUDE.md, AGENTS.md
workflowType: prd
classification:
  projectType: frontend-dependency-migration
  domain: shared-ui-primitives-and-font-pipeline
  complexity: medium-high
  projectContext: brownfield-retrospective
status: Draft
---

# Product Requirements Document - Wire `@vilnacrm/ui-toolkit` into the website (#458)

**Author:** BMad PM **Date:** 2026-09-09 **Source:** [website#458](https://github.com/VilnaCRM-Org/website/issues/458), realised by [PR #459](https://github.com/VilnaCRM-Org/website/pull/459) **Upstream:** [`research-…`](./research-458-ui-toolkit-primitives-2026-09-09.md), [`brief-…`](./brief-458-ui-toolkit-primitives-2026-09-09.md)

## Executive Summary

`@vilnacrm/ui-toolkit` was extracted from this repository, so `src/components/ui-*` and the toolkit now hold two implementations of one design. Each side has since gained work the other lacks: upstream added keyboard operation and ARIA to `UiTooltip` and `aria-invalid` to `UiCheckbox`; this repository added the #382 F2/F3 fixes — a case-folded `target` comparison before `rel` hardening, and `aria-describedby`/`aria-required` delivered onto the `<input>` through `slotProps.htmlInput` rather than onto the FormControl. Neither copy is authoritative, so every `Ui*` change costs a reviewer the question "which copy is ahead on which concern?", answerable only from issue history.

This PRD specifies making the toolkit the single design source for nine `src/components/ui-*` modules while keeping each `@/components/...` path as an **import seam**, so the `@/components` barrel and all 93 measured import statements (79 of them outside the test trees) are untouched. Three seams keep thin local adapters over toolkit components — `ui-link`, `ui-input`, `ui-button` — each justified by a committed regression test rather than by preference; `ui-text-field-form` stays local as a composite that re-composes those seams and is not an adapter. Because the toolkit's themes name the font families literally — `fontFamily:"Inter"` 36 times, `fontFamily:"Golos Text"` 22 times in `build/index.mjs` — and `next/font` mints an opaque per-import family name that can never satisfy them, the change also rewrites the font pipeline onto `@font-face` declarations in `styles/global.css` over the `.woff2` assets already committed. That second half is what moves pixels and bytes.

The requirements below are stated so that the change is verifiable rather than asserted: a committed SHA-256 digest for a dependency whose lockfile entry carries none, a payload reduction rather than a budget change, a visual-baseline procedure that separates two candidate causes before any PNG is regenerated, and an accessibility contract restated per seam. This is a **retrospective** PRD — the realising PR exists and is red on four checks — so a dedicated section records where the current attempt does not yet meet these requirements, stated as unmet FRs rather than as defects of authorship.

## What Makes This Special

Three characteristics separate this from an ordinary dependency bump, and each one changes what the requirements must say.

**First, the dependency has no integrity check and no gate that would notice.** `bun.lock` records a remote tarball as the 2-element `[spec, {peerDependencies}]` form with no `sha512`, unlike every registry entry beside it, and `Dockerfile:21` runs `bun install --frozen-lockfile` in the `base` stage — so every dev-image build and every BuildKit cache miss refetches a GitHub release asset that is mutable by anyone with upstream push access. `config/osv-scanner.toml`'s differential scan cannot key a remote-tarball entry to an ecosystem/package pair, so the dependency sits outside SCA coverage entirely. The toolkit's `CONSUMING.md` claims the lockfile hash makes the pin tamper-evident; that claim is false for this dependency form and must not be relied on. The repository already solved this exact problem once, for the user-service contracts (`contracts/user-service/checksums.json` + `make lint-contracts`, #376), and that precedent is unapplied here.

**Second, it is not a like-for-like swap — it is a swap plus a font-pipeline rewrite, and the rewrite is the part with blast radius.** Replacing `next/font` changes what every page paints, which is why 132 of 156 visual tests move rather than the three the CI digest names, and why one screen changed *height* (414x1562 to 414x1541) rather than merely anti-aliasing. It also removes a latent defect: `_fonts.scss` hardcodes `next/font`'s generated hashes (`__golos_58e94b`, `__inter_74e140`) by hand, and nothing in the repository checks that they are still current, so `/swagger`'s entire typography rests on an unverified string.

**Third, the two upgrades this change buys are accessibility upgrades, which makes "no regression" the whole point.** The toolkit's `UiTooltip` adds Enter/Space/Escape, `role="button"`, `aria-expanded` and `aria-controls`; its `UiCheckbox` adds `aria-invalid`. Both arrive only if the local hardening survives the swap — so every seam in this document carries its accessibility acceptance criteria inline, and the interaction states the tooltip newly gains must be registered in `src/test/a11y/interaction-states.ts` rather than left to a route scan that only ever sees initial load.

## Project Classification

| Attribute | Value |
| --- | --- |
| Project type | Frontend dependency migration + font-pipeline rewrite (shared UI primitives) |
| Domain | Shared design-system primitives, self-hosted typography, supply-chain pinning |
| Complexity | Medium-high — small diff, wide blast radius: 9 seams, 93 import statements, 234 visual baselines, 3 accessibility layers, 1 byte budget |
| Project context | Brownfield, retrospective — PR #459 exists and is red on four checks |
| Primary users | Contributors changing a `Ui*`; reviewers judging a visual diff; end users of `/` and `/swagger`; bilingual (uk/en) users; CI maintainers |
| Risk profile | Medium-high blast radius — every page's typography and every `_blank` link's accessible name change; mitigated by gates that must not be relaxed |

## Success Criteria

### User Success

- An end user of `/` and `/swagger` sees no perceptible change in rendered typography, and gains the toolkit's tooltip keyboard operation and checkbox `aria-invalid` without losing this site's `rel` hardening or `aria-describedby` delivery.
- A bilingual user hears the new-tab cue in the language they are browsing in, not a hardcoded English `(opens in new tab)`.
- A contributor changing a shared primitive changes it in one place, and the seam file is short enough to read in full.
- A reviewer facing the diff reviews three adapters and one font change, each with a named reason, instead of 1,310 deleted lines.

### Business Success

- The design system stops being maintained twice. A `Ui*` fix lands once and reaches both consumers, and the CRM sister repository (VilnaCRM-Org/crm#250) inherits a proven adapter list instead of rediscovering it.
- Each remaining adapter is debt with a named payoff — a specific upstream defect, filed, that retires the adapter when fixed.

### Technical Success

- Nine `ui-*` modules render from the toolkit behind unchanged import paths; `make lint` and every Jest layer pass with the integration layer still at 100%.
- The dependency is verifiable offline: a committed SHA-256 digest plus a check that reads it, and a single version pin rather than a restated one.
- Static JS stays inside `3,300,000` bytes by trimming payload, never by moving the budget.
- Every regenerated visual baseline carries a written cause distinguishing "the font now renders as intended" from "the page changed".

### Measurable Outcomes

- **Seam integrity:** 0 call sites changed outside `src/components/ui-*/index.*` and their `types.ts`.
- **Coverage:** integration layer 100% statements/branches/functions/lines with every adapter branch driven; client layer at or above 92/95/97/97; edge layer 100% per file; `scripts/verifyUiToolkit.mjs` at 100% per file inside the client layer.
- **Bytes:** measured static JS <= 3,300,000 B (currently 3,336,275 B, i.e. 36,275 B / 1.10% over); added font payload 0 B over the 472,032 B of `.woff2` already shipped.
- **Accessibility:** 0 serious/critical and 0 unset-impact axe violations across the three enforcement layers; 0 deleted accessibility or security assertions.
- **Visual:** 0 blind baseline updates; every changed PNG reviewed by the CODEOWNERS owner of `src/test/visual/**-snapshots/`.
- **Supply chain:** 1 committed digest, 1 version pin, 1 check that fails when the fetched artifact does not match.

## User Journeys

### Journey 1: The contributor swapping a primitive

**Persona:** Maria, a frontend engineer asked to fix a focus ring on `UiCheckbox`.

**Opening Scene:** Before this change, Maria finds two `UiCheckbox` implementations — a styled native `<input type="checkbox">` here and MUI's control behind a `span.ui-checkbox-box` upstream — and no rule saying which is authoritative. She fixes the local one, and the toolkit's other consumer never gets it.

**Rising Action:** After this change, `src/components/ui-checkbox/index.tsx` is a re-export. There is nothing local to fix; the fix belongs upstream, and Maria can see that from the file itself in ten seconds.

**Climax:** Maria checks whether her component is one of the three adapters. It is not — so no local behaviour depends on it, and the upstream fix reaches the site when the pin moves. If it *had* been an adapter, the seam would have named the regression test that justifies its existence, so she would know exactly what she must not break.

**Resolution:** One fix, one place, both consumers. The "which copy is ahead?" question no longer exists for the nine swapped modules.

**Reveals requirements for:** FR5–FR8 (re-export seams), FR9–FR14 (adapters and their named justifications), FR27 (each adapter cites its regression test), NFR14 (public-API seam holds at the path level).

### Journey 2: The reviewer judging a visual diff

**Persona:** Kravalg, the CODEOWNERS owner of `src/test/visual/**-snapshots/`.

**Opening Scene:** The visual job is red on 132 of 156 tests. The obvious move — `make test-visual-update`, approve, merge — would work, and would be wrong: `playwright.config.ts` sets no `maxDiffPixels` and no `threshold`, and the baselines are CODEOWNERS-protected precisely because an approved wrong baseline certifies itself (#344).

**Rising Action:** The diff shows `uk_largeMobile` moved from 414x1562 to 414x1541. Twenty-one pixels of height is a font-metric change, not anti-aliasing, and two mechanisms can produce it: hand-written `size-adjust`/`ascent-override` fallbacks differing from what `next/font` derived, or the stale `__golos_58e94b` hash having meant `/swagger` was already rendering in a fallback face on `main`.

**Climax:** The change ships the isolation experiment required by FR35 — one build with `_fonts.scss` on the old generated names, one on the real family names — so the two causes are separated before any PNG is touched. The swagger set moving under isolation means the hashes were stale and the new baselines record an intended fix; the landing set moving means the fallback metrics are wrong and must be recomputed.

**Resolution:** Kravalg approves a regeneration whose every image has a recorded cause, or rejects one whose metrics are simply wrong. The baseline stops being self-certifying.

**Reveals requirements for:** FR34–FR36 (reviewed-not-blind baselines), FR18 (fallback metrics are derived data with a recompute rule), NFR17 (no baseline relaxation), G6.

### Journey 3: The end user on `/swagger` with fonts

**Persona:** Olena, an integrator reading the API documentation on a laptop.

**Opening Scene:** `/swagger`'s typography flows from `_fonts.scss`'s `$golos`/`$inter` into `_ui-typography.scss` and `styles.scss`. Those two variables hold `next/font`'s generated hashes, hand-copied. Olena has no way to tell whether she is seeing Golos Text or a fallback, and neither does CI.

**Rising Action:** After this change `_fonts.scss` names `'Golos Text', sans-serif` and `'Inter', sans-serif` — families a browser can actually resolve — and `styles/global.css` declares those faces against the same `.woff2` files already shipped, with `font-display: swap` so text is never invisible while a face loads.

**Climax:** The alternative — importing `@vilnacrm/ui-toolkit/styles.css` — was rejected: it carries 9 `@font-face` rules over `.ttf` totalling 1,348,788 B, against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger). Olena's page would have paid 1.29 MiB for fonts she already had.

**Resolution:** Same files, same weights, one loading mechanism, no duplicate download, no added payload — and the family names are now verifiable rather than a hash nobody re-derives.

**Reveals requirements for:** FR15–FR20 (font pipeline), NFR8–NFR10 (performance), G9.

### Journey 4: The bilingual user hitting a new-tab link

**Persona:** Andriy, browsing the Ukrainian site (`NEXT_PUBLIC_MAIN_LANGUAGE=uk`) with a screen reader.

**Opening Scene:** The toolkit's `UiLink` renders a visually-hidden `newTabLabel` defaulting to the hardcoded English `(opens in new tab)`. On a Ukrainian page, Andriy hears an English phrase spliced into a Ukrainian link name.

**Rising Action:** The `ui-link` adapter localizes the cue through `useTranslation()` and suppresses the hardcoded default, so the cue is either the site's own translated string or absent.

**Climax:** Two consequences follow and both are requirements. The cue changes **every** `_blank` link's accessible name, so name-based locators across e2e, a11y route sweeps and interaction states must be updated with the change, not after it. And the toolkit gates the cue on the same strict `target === '_blank'` comparison that gates `rel`, so a `_BLANK` link gets the adapter's hardened `rel` but no cue — a documented, tested limitation, not a silent one.

**Resolution:** Andriy hears a Ukrainian cue. Anna, on `/en`, hears an English one. Neither hears a string the site did not author.

**Reveals requirements for:** FR12 (`ui-link` adapter), FR28–FR30 (i18n key placement and locator repair), NFR16 (no hardcoded English), FR14 (documented `_BLANK` cue limitation).

### Journey 5: The CI maintainer chasing the byte budget

**Persona:** Pavlo, who maintains CI across both repositories.

**Opening Scene:** `build-artifact` is red: 3,336,275 B against `js_budget=3300000`. The script's own comment reads "current actual (~3.13 MB) + ~5% headroom; never raise it", and `.claude/react-sdlc.yml`'s `quality.*` are raise-only. The one-line fix is forbidden by the gate it would edit.

**Rising Action:** Pavlo produces the artifact FR32 requires: a `make build-analyze` bundle diff against `main`. Nine per-primitive `createTheme`/`ThemeProvider` calls were retired, so bytes should have come back; if they did not, a surviving `@mui/material` barrel import in a seam is the first suspect.

**Climax:** If the diff closes 36,275 B, the change ships. If it does not, the honest outcome is that the change is not shippable in this form and the toolkit must ship per-component entry points first — `build/index.mjs` is a single 275.7 KB ESM module whose components share theme objects, so tree-shaking recovers less than the component count suggests.

**Resolution:** The budget is met by trimming or the change waits. Either way the number in `validate-build-artifact.sh` is the same number it was.

**Reveals requirements for:** FR31–FR33 (bundle budget), NFR8, NFR17 (no threshold relaxation), G1, G3.

### Journey Requirements Summary

| Journey | Primary requirements surfaced |
| --- | --- |
| 1 — Contributor swapping a primitive | FR5–FR14, FR27, NFR14 |
| 2 — Reviewer judging a visual diff | FR18, FR34–FR36, NFR17 |
| 3 — End user on `/swagger` with fonts | FR15–FR20, NFR8–NFR10 |
| 4 — Bilingual user hitting a new-tab link | FR12, FR14, FR28–FR30, NFR16 |
| 5 — CI maintainer chasing the byte budget | FR31–FR33, NFR8, NFR17 |

## Scope

### In scope — Phase 1 (the change itself)

The nine `src/components/ui-*` modules the research confirms are changed, plus the supporting work each forces.

| Module | Treatment |
| --- | --- |
| `ui-color-theme` | Re-export `websiteColorTheme as UiColorTheme` |
| `ui-breakpoints` | Re-export `websiteBreakpointsTheme as UiBreakpoints` |
| `ui-typography` | Re-export; ARIA flows via `...rest` |
| `ui-checkbox` | Re-export; local `styles.ts` / `types.ts` retire |
| `ui-toolbar` | Re-export; local `theme.ts` retires |
| `ui-tooltip` | Re-export; `tooltip-wrapper.tsx` retires, keyboard states gained |
| `ui-button` | Adapter — falsy-`href` drop, `rel`/`target` prop declarations |
| `ui-link` | Adapter — `resolveExternalLinkRel`, localized `newTabLabel` |
| `ui-input` | Adapter — `buildInputSlotProps`, explicit prop allow-list |

Supporting work: the tarball pin and its committed digest; `styles/global.css` `@font-face` declarations with fallback metrics; dropping `next/font` and rewriting `_fonts.scss` to real family names; Jest and Stryker resolver mappings; a shared i18n key for the new-tab cue; Storybook stories rewritten against the seams with `.storybook/preview.ts` importing the global stylesheet and the dead `staticDirs` font block removed; the spec and locator updates the seam changes force.

### In scope — Phase 2 (unblocking, only if Phase 1 cannot close the budget)

Push upstream for per-component entry points so bundle cost scales with what is consumed rather than with the whole package, and re-attempt. This phase is a fallback, not a deferral of Phase 1's gates.

### Out of scope

- **Rewriting `UiTextFieldForm` onto the toolkit's equivalent.** The local version is strictly richer (live-region errors, `composeDescribedBy`, `isRequiredRule`); it composes the toolkit-backed primitives and stops there. It is a local **composite**, not an adapter, and does not count against FR9's cap of three; its live-region errors, `composeDescribedBy` and `isRequiredRule` are unchanged by this work.
- **`UiImage`.** It depends on `next-export-optimize-images`, which the toolkit cannot provide. It stays local and untouched; the PR narrative listing it among the swapped primitives is a description error — `UiInput` is the ninth changed module.
- **Fixing the toolkit.** The seven upstream gaps are filed, not fixed here; this change lands against `v0.3.0` as published.
- **The CRM migration.** VilnaCRM-Org/crm#250 is blocked on its own React 19 / MUI 9 upgrade.
- **Adopting toolkit components this site does not already have.** The scope is replacing duplicates, which is also what keeps the bundle argument honest.

## Functional Requirements

Each FR is measurable and carries its trace to the issue's acceptance criteria (AC1–AC8, enumerated in the Traceability Matrix) and the brief's goals G1–G10.

### Dependency pin and committed digest

- **FR1:** The toolkit can be pinned to exactly one immutable release-tarball URL, recorded once. A git ref is not an option: every entry point resolves into the gitignored `build/`, and bun does not install a git dependency's devDependencies, so a `prepare` build cannot rescue it (verified on bun 1.3.5 — `prepare: husky` exits 127). *(AC1, G10)*
- **FR2:** The pinned version can live in a single source-of-truth variable — `UI_TOOLKIT_VERSION` in `.env`, modelled on `USER_SERVICE_VERSION` — with every consumer **restating it verifiably** — held to the pin by a gate, in the `.nvmrc` shape, because `package.json` cannot interpolate a variable (recorded as an architecture assumption under AD-9). A second version variable, or a hardcoded tag in a root config file that no gate holds to the pin, is a defect. *(AC1, G10)*
- **FR3:** The tarball's SHA-256 can be committed to the repository and verified before the artifact is used, modelled on `contracts/user-service/checksums.json` and `make lint-contracts` (#376). The check fails when the fetched bytes do not match the committed digest. *(AC6, G10)*
- **FR4:** The verification can run without network access to a third-party service and without trusting `bun.lock`, whose remote-tarball entry records no `sha512` at all. Documentation must not repeat `CONSUMING.md`'s claim that the lockfile hash makes the pin tamper-evident. *(AC6, G10)*

### Import-seam re-exports

- **FR5:** Each of `ui-color-theme`, `ui-breakpoints`, `ui-typography`, `ui-checkbox`, `ui-toolbar`, `ui-tooltip` can re-export the toolkit component from its existing `src/components/<dir>/index` path, so `src/components/index.ts` and every consumer import statement are unchanged. Verified by: 0 changed files outside `src/components/ui-*/index.*` and `types.ts` in the seam commit. *(AC1, G1)*
- **FR6:** The seam can hold at the **path** level, not only at the barrel: `src/components/ui-breakpoints` and `src/components/ui-color-theme` keep their module path and default export, so every deep import resolves unchanged. Verified by: 0 changed files outside those two `index.ts`. *Rationale, measured rather than required:* the two heaviest consumers are deep-path rather than barrel — 28 imports of `ui-breakpoints` and 22 of `ui-color-theme` — and `UiBreakpoints` is byte-identical while `UiColorTheme` is value-identical but for `success`, which this repository never references. Those are findings, not obligations; the `success` delta is the one part of them that can fail, and it is checked by the theme-contract spec rather than by this FR. *(AC1, G1)*
- **FR7:** `ui-tooltip` can retire `tooltip-wrapper.tsx` and its local theme while preserving click-toggle in both directions, `ClickAwayListener` dismissal, and close-on-breakpoint-change. **A11y acceptance:** the toolkit's added Enter/Space/Escape operation, `role="button"`, `aria-expanded` and `aria-controls` must be present and asserted; the trigger must have an accessible name; the open and closed states must both scan clean at serious/critical and unset impact. *(AC1, AC6, G7, G8)*
- **FR8:** `ui-checkbox` can retire `styles.ts` and `types.ts` and render the toolkit's MUI control with `span.ui-checkbox-box`, preserving the `1.5rem` box, `0.5rem` radius, `grey400`/`error` borders and check SVG. **A11y acceptance:** label association, disabled state, controlled `checked` and `aria-invalid` remain asserted, the toolkit's `aria-invalid` addition is exercised, and `expectNoA11yViolations` still passes for the component. *(AC1, AC6, G7, G8)*

### Adapters preserving exact accessibility and security behaviour

- **FR9:** Where the toolkit would regress shipped behaviour, the seam can hold a thin adapter over the toolkit component rather than a local reimplementation, and each adapter must name the committed regression test that justifies it. Adapters are enumerated exhaustively and the set is **exactly three** — `ui-link`, `ui-input`, `ui-button`. `ui-text-field-form` stays local as a composite that re-composes those seams rather than adapting a toolkit component, so it is not one of them and is carried by the Out-of-scope entry instead. A **fourth** adapter is a scope change. *(AC2, G1)*
- **FR10:** `ui-input` can keep `buildInputSlotProps`, so `aria-describedby` and `aria-required` land on the `<input>` via `slotProps.htmlInput` rather than on the FormControl. **A11y acceptance:** `AuthForm`'s `password-requirements` association survives end to end; `required` emits ARIA only and never the native attribute; `UiInput.test.tsx` and `UiTextFieldForm.test.tsx` assertions are unchanged, not relaxed. *(AC2, AC6, G7)*
- **FR11:** `UiInputProps` can remain an **explicit prop allow-list** over the toolkit type, retaining the documented `name`/`autoComplete` rationale, rather than widening to `Omit<ComponentProps<typeof UiInput>, …>` — i.e. the whole of `TextFieldProps`. The narrow surface is the #382 F3 artefact that keeps `required` off the DOM. *(AC2, AC6, G7)*
- **FR12:** `ui-link` can keep `resolveExternalLinkRel` from `src/shared/externalLinkRel.ts`, which case-folds `target` before comparing to `_blank`, and can merge caller-supplied `rel` tokens rather than replacing them. **Security acceptance:** a `_BLANK` target still receives `noopener noreferrer`; `UiLink.test.tsx`'s "hardens a case-variant blank target" case and `tests/integration/coverage/shared/external-link-rel.integration.test.ts` both pass unmodified. *(AC2, AC6, G7)*
- **FR13:** `ui-button` can keep the falsy-`href` drop, so a falsy `href` never turns a `<button>` into a destination-less `<a>`, and can declare `rel`/`target` on its prop type over `ComponentProps<typeof UiButton>` — the toolkit forwards them at runtime but omits them from its type. *(AC2, G7)*
- **FR14:** `ui-link` can localize `newTabLabel` through `useTranslation()` and suppress the toolkit's hardcoded English default. **A11y acceptance:** every `_blank` link's accessible name carries the localized cue; the known limitation that a `_BLANK` link receives the hardened `rel` but **no** cue (the toolkit gates both on the same strict comparison) is asserted in a test and recorded as upstream gap 1, not left implicit. *(AC2, AC6, AC8, G7)*

### Font pipeline

- **FR15:** `styles/global.css` can declare `Inter` and `Golos Text` under their real family names against the `.woff2` assets already committed (472,032 B across nine faces), so the toolkit's 58 literal `fontFamily` references resolve. *(AC4, G3, G9)*
- **FR16:** `next/font/local` can be dropped for these families, because a generated per-import family name can never satisfy a literal reference. No page may depend on a `next/font` class for these two families after the change. *(AC4, G3)*
- **FR17:** Importing `@vilnacrm/ui-toolkit/styles.css` is rejected as the mechanism: it ships `.ttf` totalling 1,348,788 B against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger). The requirement is zero added font payload. *(AC4, G9)*
- **FR18:** The metric-adjusted fallback faces (`size-adjust`, `ascent-override`, `descent-override` over `local('Arial')`) can be treated as **derived data with a recorded recompute rule**, not as constants copied forward. A change to a face requires recomputation, and the recompute procedure is documented next to the values. *(AC4, AC7, G6)*
- **FR19:** `_fonts.scss` can stop hardcoding `next/font`'s generated hashes and name `'Golos Text', sans-serif` / `'Inter', sans-serif` instead, removing the unverified string on which `/swagger`'s entire typography currently depends. *(AC4, G3)*
- **FR20:** `.storybook/preview.ts` can import `styles/global.css` and `.storybook/main.ts` can drop the now-dead `staticDirs` font block, so Storybook renders the same faces production does. Otherwise `storybook build` ships a design surface that no longer matches production — precisely the drift #458 exists to stop. *(AC4, G1)*

### Jest and Stryker module resolution

- **FR21:** `jest.config.ts` can map the ESM-only package to its built bundle, because the package's `exports` map declares no `require` condition and the CJS resolver therefore fails at **resolution**, not at parse. *(AC3, G2)*
- **FR22:** `jest.mutation.config.ts` can carry the identical mapping, because Stryker's in-process Jest runner loads that config and this repository has already been bitten by the two diverging. No `ui-*` file is mutated by any scope, but a resolution failure in an unrelated mutant's related specs reads as an all-survived result indistinguishable from genuinely weak tests. *(AC3, G2)*
- **FR23:** Both configs can extend the existing ESM `transformIgnorePatterns` allow-list so babel-jest transforms the package's `.mjs`. The two configs' toolkit-related entries must be identical; a divergence is a defect. *(AC3, G2)*

### Tests, stories and i18n

- **FR24:** Every Jest layer can pass — `client`, `server`, `edge`, `integration`, `contract` — with the **integration layer still at 100%** statements, branches, functions and lines. *(AC5, G2, G4)*
- **FR25:** Every branch of both adapters can be driven at the integration layer, including the `_BLANK` path, the falsy-`href` path, the caller-`rel`-merge path and the localized-cue path. *(AC5, G4)*
- **FR26:** The client and edge layers can hold their floors — client at or above 92 branches / 95 functions / 97 lines / 97 statements; edge 100% per file. The new `scripts/verifyUiToolkit.mjs` is covered in the **client** layer, which is the only layer that can collect it: that layer keeps Jest's default imported-file coverage scope, exactly as `src/test/unit/contracts/check-api-versions.test.ts` already puts `scripts/contracts/check-api-versions.mjs` under coverage today. It is not covered at the integration layer, whose `collectCoverageFrom` is `src/**` plus exclusions, so a `scripts/`-rooted module is never collected there and a 100% verdict would be silent about it; and it is not added to the edge layer's explicit file list, whose scope is the shipped runtime scripts. Because the client floors are global and would pass with the verifier entirely uncovered, it is held instead by a dedicated **per-file** 100% coverage-threshold group. Adding that group raises enforcement; it lowers nothing. *(AC5, AC6, G5)*
- **FR27:** No accessibility or security assertion can be deleted. An assertion may move layers only when its replacement is named in the same diff; it may never be made conditional, skipped, or satisfied by inspecting the dependency's own exported styles rather than the app's rendered output. *(AC6, G7)*
- **FR28:** The new-tab i18n key can live in a **shared** i18n namespace rather than `src/features/landing/i18n/`. A shared primitive reading a feature bundle is boundary erosion that `no-shared-layers-to-features` cannot catch, because the coupling runs through i18next's flat resource merge rather than through an import. *(AC6, G1)*
- **FR29:** Every name-based locator affected by the cue can be repaired in the same change — `AuthFormPolicyLinks.test.tsx`, `src/test/e2e/register-form/constants.ts`, and any e2e, a11y-route or interaction-state locator matching on a link or label name. *(AC5, AC6, G7)*
- **FR30:** The six deleted Storybook story files can be rewritten against the toolkit-backed seams rather than deleted. No gate requires a story to exist — `scripts/ci/mutation-scope.ts` only *excludes* `*.stories.tsx` — so deletion passes CI silently while halving the reviewable design surface. *(AC6, G1)*

### Bundle budget

- **FR31:** Measured static JS can be at or below `3,300,000` bytes as enforced by `scripts/ci/validate-build-artifact.sh`. The budget value is not an input to this change: the script's own comment reads "never raise it". *(AC6, G1, G3)*
- **FR32:** A `make build-analyze` bundle diff against `main` can be produced as the first artifact of the byte fix, so the trim is directed rather than guessed. The retired per-primitive `createTheme`/`ThemeProvider` calls should already have returned bytes. A surviving `@mui/material` barrel import in a seam was this document's first suspect and is **already ruled out by measurement** — after the change no `src/components/ui-*/index.*` imports `@mui/material` at all, recorded in the architecture's AD-10 step 2 — so the directed trim starts from chunk duplication and failed tree-shaking, not from re-checking a cleared hypothesis. *(AC6, G3)*
- **FR33:** If no trim closes the 36,275 B gap, the change can be declared not shippable in this form pending upstream per-component entry points. That branch has a stated exit rather than an implicit stall: the entry-point request is filed as FR37's **gap 7** before the branch is closed out, so the prerequisite the fallback depends on has an owner; the visual-baseline work (FR34–FR36) is **suspended, not skipped**, because it is measured over the tree the byte fix produces and there is no such tree — no PNG is regenerated and no baseline update runs; the upstream-gap and documentation work still completes, because it is what makes re-entry possible; and PR #459 is converted to **draft** rather than merged or closed, so the seam, digest and font work survives until an upstream release carrying per-component entry points lands. Shipping over budget, or with the budget moved, is not an outcome. *(AC6, AC8, G1, G3)*

### Visual baselines: reviewed, not blind

- **FR34:** No visual baseline can be regenerated before the cause of its movement is established. `playwright.config.ts` sets no `maxDiffPixels` and no `threshold`, so any differing pixel fails by design, and `.github/CODEOWNERS` gates `src/test/visual/**-snapshots/` because an approved wrong baseline certifies itself (#344). *(AC7, G6)*
- **FR35:** The two candidate causes can be separated mechanically before any PNG is touched: build once with `_fonts.scss` on the old generated names and once on the real family names, and diff. Swagger-set movement under isolation means the hashes were stale and the new baselines record an intended fix; landing-set movement means the fallback metrics are wrong and must be **recomputed**, not baselined. *(AC7, G6)*
- **FR36:** Each regenerated PNG can carry a written cause in the change record, distinguishing "the font now renders as intended" from "the page changed", reviewed by the CODEOWNERS owner. Note that `NEXT_PUBLIC_MAIN_LANGUAGE=uk`, so the `uk` set is the whole live estate and the `en` baselines did not run — any claim of visual impact must be read against `uk`. *(AC7, G6)*

### Upstream gaps

- **FR37:** All seven upstream gaps can be filed against `ui-toolkit` with the adapter each keeps alive and the condition that retires it: (1) case-sensitive `rel` hardening — a security defect that also suppresses the `_BLANK` cue; (2) the exported `Ui*Props` set excludes exactly the interfaces this repository consumes, so `ComponentProps<typeof X>` is the correct workaround meanwhile; (3) hardcoded, non-tokenized font families; (4) English-defaulted `newTabLabel`; (5) optional props omitting `| undefined`, which breaks under `exactOptionalPropertyTypes`; (6) three bare `fontFamily:"Golos"` references with no matching `@font-face` anywhere; (7) **no per-component entry points** — `build/index.mjs` is a single 275.7 KB ESM module whose components share theme objects, so bundle cost scales with the whole package rather than with what is consumed. Gap 7 retires no adapter; it is the prerequisite FR33's not-shippable branch waits on, which is why it is filed with the other six rather than assumed. *(AC6, AC8)*

## Traceability Matrix

| Issue AC | FR | Verification gate / make target |
| --- | --- | --- |
| AC1 — Swap the nine listed primitives to the toolkit behind the `@/components` seam | FR1, FR2, FR5, FR6, FR7, FR8 | `make lint-deps`, `make lint-tsc`, `make test-unit-client`, `make test-integration` |
| AC2 — Keep `UiInput`, `UiLink`, `UiButton`, `UiTextFieldForm` local because the toolkit would regress shipped behaviour | FR9, FR10, FR11, FR12, FR13, FR14 (`UiTextFieldForm` reaches no FR of its own by design: it is a local composite over the seams, not an adapter, carried by FR9's composite clause and the Out-of-scope entry) | `make test-unit-client`, `make test-integration`, `make test-a11y`, `make test-e2e` |
| AC3 — Teach Jest to resolve the ESM-only package in both `jest.config.ts` and `jest.mutation.config.ts` | FR21, FR22, FR23 | `make test-unit-all`, `make test-mutation-changed`, `make merge-mutation-reports` |
| AC4 — Font wiring via `styles/global.css` against the existing `.woff2`, not the toolkit's `.ttf` `styles.css` | FR15, FR16, FR17, FR18, FR19, FR20 | `make lighthouse-desktop`, `make lighthouse-mobile`, `make storybook-build`, `make test-visual` |
| AC5 — `make lint` and every Jest layer pass, integration still at 100% | FR24, FR25, FR26, FR29 | `make lint`, `make test-unit-all`, `make test-integration`, `make ci-test` |
| AC6 — No accessibility or security behaviour weakened; no baseline, threshold or gate relaxed | FR3, FR4, FR7, FR8, FR10, FR11, FR12, FR14, FR27, FR28, FR30, FR31, FR32, FR33 | `make test-a11y`, `make lint-next`, `make lint-headers`, `scripts/ci/validate-build-artifact.sh`, diff review of every gate config |
| AC7 — Visual regression reviewed rather than blind-updated | FR18, FR34, FR35, FR36 | `make test-visual`, `make test-visual-update` (only post-review), CODEOWNERS review of `src/test/visual/**-snapshots/` |
| AC8 — Upstream gaps filed so the adapters can eventually retire | FR14, FR37 | GitHub issues on `VilnaCRM-Org/ui-toolkit`, referenced from each adapter |

## Non-Functional Requirements

### Quality floors (raise-only, restated from `.claude/react-sdlc.yml`)

- **NFR1:** Coverage dimensions — statements, branches, functions, lines — hold at **100** for the integration layer, and the client and edge layers hold their own configured floors. These are floors that may be raised, never lowered.
- **NFR2:** Mutation MSI holds at **100** for the `curated` scope. No `ui-*` file is in the curated list or matches `config/mutation-policy.json`'s `mutableDirectories`, so this change must not alter that scope to accommodate itself.
- **NFR3:** ESLint errors **0**, ESLint warnings **0**, `tsc` errors **0**, markdownlint errors **0**, dependency-cruiser violations **0**, jscpd clones **0**, visual diffs **0**.
- **NFR4:** `metrics_enforced: true` — the rust-code-analysis hard thresholds in `config/metrics-policy.json` apply unchanged to every seam and adapter file. Complexity is reduced by refactoring, never by editing the policy.
- **NFR5:** Lighthouse category floors hold at **85 desktop / 40 mobile**, the repository's deliberate, evidence-based floors for this CSR landing, alongside the per-URL byte assertions in `lighthouserc.desktop.js` / `lighthouserc.mobile.js`.

### Accessibility (WCAG 2.1 AA)

- **NFR6:** The binding conformance target is **WCAG 2.1 AA**, enforced per rule at all three layers: `jest-axe` over rendered components in the client Jest suite; `@axe-core/playwright` plus a keyboard sweep over every route in `src/test/a11y/routes.ts`; and axe at runtime interaction states inside the Playwright e2e journeys. Scans gate on serious/critical impact **and** on any violation axe reports with no impact at all.
- **NFR7:** The tooltip's newly gained keyboard states — trigger focused, expanded via Enter/Space, dismissed via Escape — are registered in `src/test/a11y/interaction-states.ts` and driven by `scanInteractionState` from the journey that opens the tooltip. A route scan only ever sees initial load, so composed and conditional DOM is reachable nowhere else. The registry-drift unit test must stay green without being edited to accommodate an unregistered state.

### Performance

- **NFR8:** Measured static JS stays at or below **3,300,000 bytes**. The path to compliance is payload reduction; the budget is not an input.
- **NFR9:** **No added font payload.** The change ships the 472,032 B of `.woff2` already committed and adds nothing; the `.ttf` route (1,348,788 B) is rejected outright.
- **NFR10:** Every declared face uses `font-display: swap`, so text is never invisible while a face loads. The metric-adjusted fallbacks are held correct by **recomputation**: the authoritative discriminator is FR18's recompute from the committed `-Regular.woff2`, run as the architecture's Build B. Lab CLS on this repository's mobile lane is a known-unstable measurement and is therefore corroborating evidence only — it can neither prove a metric right nor, on its own, prove one wrong.

### Security and supply chain

- **NFR11:** `rel` hardening is **case-insensitive** on `target`, matching the HTML specification's ASCII case-insensitive keyword comparison. A `_BLANK` target receives `noopener noreferrer`; the existing regression test proves it.
- **NFR12:** No `describedBy` loss. `aria-describedby` and `aria-required` reach the `<input>` element itself, not the surrounding FormControl, for every consumer of the `ui-input` seam.
- **NFR13:** The dependency's integrity is provable offline from a committed SHA-256 digest. `bun.lock` provides no `sha512` for a remote tarball and `config/osv-scanner.toml` cannot key such an entry to a package coordinate, so the digest is the only integrity signal that exists — it is a hard requirement, not defence in depth.

### Architecture and internationalisation

- **NFR14:** The public-API seam holds: `src/components/index.ts` and each `ui-*/index` remain the only import surfaces, and a shared primitive never imports a feature (`no-shared-ui-to-features`, `no-shared-layers-to-features`).
- **NFR15:** `src/config/Fonts/families.ts` and every new module must have a real importer — `no-orphans` is enforced — and the toolkit stays in `dependencies`, keeping `not-to-dev-dep` clean.
- **NFR16:** **No hardcoded English.** Every user-facing string, including the visually-hidden new-tab cue, resolves through `t()` against both `en` and `uk` bundles. Assertions match on the translated string, never on a literal.

### The non-relaxation rule

- **NFR17:** **No gate, threshold, budget, allow-list or baseline may be relaxed to make this change pass.** Concretely: no edit to `scripts/ci/validate-build-artifact.sh`'s `js_budget`; no `maxDiffPixels` or `threshold` added to `playwright.config.ts`; no blind `make test-visual-update`; no lowered Jest coverage threshold; no widened `config/metrics-policy.json`, `config/mutation-policy.json` or `config/osv-scanner.toml`; no lowered `.claude/react-sdlc.yml` `quality.*` value; no Lighthouse budget increase; no `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `prettier-ignore`, markdownlint disable, `test.skip`, or axe rule removal. A red gate is fixed at its root cause or the change does not ship.

## Current Gaps vs PR #459

PR #459 realises most of this document. Five requirements are not yet met. These are stated as unmet FRs so they can be closed, not as criticism of the attempt — three of them are genuinely hard, and one of them (FR3) has no CI signal that would have surfaced it.

| Gap | Evidence | Unmet FR |
| --- | --- | --- |
| Static JS is 36,275 B (1.10%) over budget | `build-artifact` FAIL — "static JS is 3336275 bytes, over budget 3300000; trim imports (do not raise the budget)" | FR31, FR32, FR33 |
| 132 of 156 visual tests fail, including a 21 px height change on `uk_largeMobile` (414x1562 to 414x1541); no isolation experiment separates the two candidate causes | `visual-test` FAIL; `scratchpad/pr459-visual.log:7514` reads `132 failed` against `24 passed`, an order of magnitude beyond the three swagger snapshots the CI digest names | FR18, FR34, FR35, FR36 |
| One Jest case fails — `UiCheckBox.test.tsx` "keeps the hover border token on the styled box" — and Codecov fails downstream | `unit`/`smoke` FAIL, 1 failed of 1003. The assertion reads `style.textContent`, which is empty whenever Emotion uses speedy insertion (`CSSStyleSheet.insertRule`) under `NODE_ENV=production`; `make` exports `.env.production`, so a container run and a bare local run disagree. The selector logic is sound — the toolkit does emit the matching rule | FR24, FR27 |
| The dependency ships with no committed digest and no check; the version is pinned only in `package.json` | `bun.lock` records the 2-element remote-tarball form with no `sha512`; no `UI_TOOLKIT_VERSION` exists; no gate reads a digest | FR1, FR2, FR3, FR4 |
| Six Storybook stories deleted rather than rewritten; `.storybook/preview.ts` imports no stylesheet and `.storybook/main.ts` keeps a dead `staticDirs` font block; the new-tab i18n key lives in the landing feature bundle | PR file list: `button`, `checkbox`, `link`, `toolbar`, `tooltip`, `typography` stories deleted; key added to `src/features/landing/i18n/{en,uk}.json` | FR20, FR28, FR30 |

Two statements in the PR narrative are inaccurate against its own diff and should be corrected so reviewers are not steered wrong. Neither affects the code.

1. The PR lists `UiImage` among the swapped primitives. It is not swapped — no `src/components/ui-image/*` path appears in the diff. `UiInput` is the ninth changed module, and `UiImage` correctly stays local because the toolkit cannot provide `next-export-optimize-images`.
2. The PR describes `UiInput` and `UiLink` as "kept local". They are **adapters over the toolkit component** — the behaviour contract is preserved, the rendering path is not. The distinction matters to a reviewer deciding how much of the toolkit's behaviour is now load-bearing.

Two measurements in the PR narrative are also imprecise: the toolkit's `.ttf` payload is 1,348,788 B (1.29 MiB), not "~1.6 MB", and the `ui-color-theme` re-export comment says 21 consumers where 22 are measured on `main`.

## Risks

- **R1 — The budget may not be closable by trimming.** `build/index.mjs` is a single 275.7 KB ESM module whose components share theme objects, so tree-shaking recovers less than the component count suggests. Mitigation: FR32's bundle diff directs the trim; FR33 makes "not shippable in this form" an acceptable outcome rather than a reason to move the budget.
- **R2 — Baseline regeneration is the tempting wrong move.** 132 red screenshots make a blind `make test-visual-update` look like the fix. Mitigation: FR35's isolation experiment and CODEOWNERS review; a wrong approved baseline is self-certifying and would silently hide a real layout regression.
- **R3 — The failing unit assertion could be "fixed" by weakening it.** Making it conditional, skipping it, or reading the toolkit's exported `styles` object would all turn the gate green while asserting nothing about the app. Mitigation: FR27 forbids all three; the durable fix reads `document.styleSheets[i].cssRules`, which is populated under both Emotion insertion modes.
- **R4 — Accessible names change site-wide and break locators far from the diff.** Every `_blank` link gains a cue. Mitigation: FR29 requires the sweep in the same change; the a11y route and interaction-state registries have drift tests that will surface an omission.
- **R5 — Prop surfaces widen where they were deliberately narrow.** Mitigation: FR11 keeps `UiInputProps` an explicit allow-list. The `UiTypography` widening is accepted — ARIA still arrives via `...rest`, and the closed `component` union was a local convention rather than a safety property.
- **R6 — The dependency is outside SCA coverage.** A remote-tarball entry carries no registry coordinates, so osv-scanner has nothing to match and the differential CVE gate is blind to it. Mitigation: FR3's digest plus FR2's single pin make a substitution detectable; the residual risk — an upstream advisory nobody surfaces — is accepted and named here rather than assumed away.
- **R7 — Storybook drifts from production.** After the font change, a Storybook that imports no stylesheet renders every toolkit component in a fallback face. Mitigation: FR20 and FR30 together.

## Open Questions

Every question this PRD raised is closed below. None is left for implementation to decide.

> Assumption: the `styles/global.css` route is the requirement, not one of two acceptable options. The toolkit's `styles.css` breaches a Lighthouse budget that may not be raised, and tokenized font families are upstream work (gap 3) that cannot gate this change.

> Assumption: the fallback metric overrides are derived data with a recompute rule recorded beside them, not constants to copy forward. Treating them as magic numbers is how a 21 px height change becomes a baseline instead of a bug.

> Assumption: the tarball digest and the single `UI_TOOLKIT_VERSION` pin are hard requirements of this change, not follow-up work. This is the one risk here with no CI signal at all, and the repository already carries the exact precedent (#376) to copy.

> Assumption: the new-tab i18n key belongs in a shared namespace. `no-shared-layers-to-features` cannot catch the landing-bundle placement, because the coupling runs through i18next's flat resource merge rather than through an import — which makes it exactly the kind of erosion only a written requirement prevents.

> Assumption: the six Storybook stories are rewritten against the seams, and `.storybook/preview.ts` imports the global stylesheet. Deleting them trades a reviewable design surface for a smaller diff, and no gate would notice.

> Assumption: `UiInputProps` stays an explicit allow-list and `UiTypographyProps` is allowed to widen. The asymmetry is deliberate: the first narrowing encodes a security property (#382 F3 keeps `required` off the DOM), the second encoded a convention.

> Assumption: the three bare `fontFamily:"Golos"` references are not a blocker, because none of the toolkit's form-level components is consumed here — but they are filed as upstream gap 6, because adopting one later would silently fall back.

> Assumption: the change is scoped to toolkit `v0.3.0` and does not wait for an upstream release. Waiting leaves the two copies drifting for the length of the toolkit's release cycle, which is the cost this change exists to stop.

> Assumption: if FR31 cannot be met by trimming, the correct outcome is that the change waits for upstream per-component entry points. "Ship 1.10% over" is not a decision available to this PRD, because the budget is a raise-only floor and the gate's own source says never to raise it.

> Assumption: the adapter count is **three**, not four. The brief's Proposed Solution table has four rows because its fourth, `ui-text-field-form`, records a local **composite** that re-composes the toolkit-backed seams rather than an adapter over a toolkit component; the brief's own scope table enumerates three adapters, and the architecture's AD-2 rule mechanically yields three. FR9's cap is therefore stated as "a fourth adapter is a scope change", because a cap that admits a fourth without a scope change caps nothing.

> Assumption: FR33's not-shippable branch has a written exit rather than an implicit stall. Gap 7 is filed, the visual-baseline work is suspended rather than skipped, the upstream-gap and documentation work still completes, and PR #459 goes to draft. Leaving the branch's consequences unstated is what turns "the honest outcome" into an abandoned branch nobody re-enters.

> Assumption: `scripts/verifyUiToolkit.mjs` is covered in the **client** layer and nowhere else, held by a per-file 100% coverage-threshold group. The integration layer structurally cannot collect a `scripts/`-rooted module, and the edge layer's 100%-per-file scope is reserved for code that actually ships to production. The client layer's global floors alone would pass with the verifier entirely uncovered, so the per-file group is what makes the requirement falsifiable — it is new enforcement, not a relaxation of any existing floor.
