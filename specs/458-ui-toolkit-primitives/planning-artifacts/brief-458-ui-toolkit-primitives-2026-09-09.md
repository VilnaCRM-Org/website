---
stepsCompleted:
  - step-01-init
  - step-02-vision
  - step-03-users
  - step-04-metrics
  - step-05-scope
  - step-06-complete
inputDocuments:
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - ./research-458-ui-toolkit-primitives-2026-09-09.md
workflowType: product-brief
classification:
  projectType: frontend-dependency-migration
  domain: shared-ui-primitives-and-font-pipeline
  complexity: medium-high
  projectContext: brownfield-retrospective
status: Draft
---

# Product Brief - Wire `@vilnacrm/ui-toolkit` into the website (#458)

**Author:** BMad Analyst **Date:** 2026-09-09 **Source:** [website#458](https://github.com/VilnaCRM-Org/website/issues/458), realised by [PR #459](https://github.com/VilnaCRM-Org/website/pull/459) **Upstream analysis:** [`research-458-ui-toolkit-primitives-2026-09-09.md`](./research-458-ui-toolkit-primitives-2026-09-09.md)

## Executive Summary

`@vilnacrm/ui-toolkit` was extracted from this repository, so `src/components/ui-*` and the toolkit now hold two implementations of one design. Since the extraction each side has gained work the other lacks: the toolkit added keyboard operation and ARIA to `UiTooltip` and `aria-invalid` to `UiCheckbox`; the website added the #382 F2/F3 security and accessibility fixes — case-insensitive `rel` hardening, and `aria-describedby`/`aria-required` reaching the `<input>` rather than the FormControl. Every further change to either side widens the gap.

This change makes the toolkit the single design source for nine `src/components/ui-*` modules, keeping each `@/components/...` path as an import seam so no call site moves, and keeping thin local adapters only where taking the toolkit verbatim would regress shipped behaviour. It is not a like-for-like swap: the toolkit's themes name the font families literally, which is incompatible with `next/font`'s generated names, so the font pipeline is rewritten in the same change. That second half is what moves pixels and bytes, and it is where the work currently falls short of its own acceptance criteria.

The realising PR is red on four checks — static JS 36,275 B over a budget that may not be raised, 132 of 156 visual snapshots, one Jest case, and Codecov downstream of it. None is clearable by relaxing anything. This brief states the outcome the change must reach and the constraints that hold whatever the implementation does, and records where the current attempt does not yet reach it.

## Problem Statement

**Two copies of one design system, drifting in opposite directions.** The nine primitives in scope exist twice. Every accessibility improvement made upstream (`UiTooltip`'s Enter / Space / Escape handling, `role="button"`, `aria-expanded`, `aria-controls`; `UiCheckbox`'s `aria-invalid`) is invisible to this site's users. Every hardening made here (#382 F2's case-folded `target` comparison, #382 F3's `slotProps.htmlInput` ARIA route) is invisible to the toolkit's other consumer, the CRM sister repository. Neither side is authoritative, so a reviewer facing a `Ui*` change has to know which copy is ahead on which concern — knowledge that lives in issue history, not in the code.

**The cost is paid three times.** Once at authoring, because a design fix has to be written twice or knowingly left half-applied. Once at review, because the design surface — Storybook stories and visual baselines — certifies only the local copy. And once at any future convergence, because the two copies diverge structurally as well as behaviourally: the local `UiCheckbox` styles a native `<input type="checkbox">` while the toolkit renders MUI's control with a `span.ui-checkbox-box`, so the merge gets harder every quarter it is deferred.

**The font pipeline is already broken by the same duplication.** `src/features/swagger/components/api-documentation/global/variables/fonts/_fonts.scss` hardcodes `next/font`'s generated family hashes (`__golos_58e94b`, `__inter_74e140`) by hand. `next/font` derives those names from loader options and file paths, so any change to `src/config/Fonts/golos.ts` silently invalidates them and nothing in the repository checks it. The entire typography of `/swagger` depends on that unverified string.

**Doing nothing is not neutral.** The toolkit is already the CRM's target (VilnaCRM-Org/crm#250, blocked on its own React 19 / MUI 9 upgrade). If the website does not adopt it, the toolkit's roadmap is set by a consumer whose constraints differ from this site's, and the website's own fixes never reach it.

## Proposed Solution

**The toolkit is the design source; `src/components/ui-*` is the seam, not the implementation.** Each `ui-*/index` re-exports or adapts the toolkit component, so the `@/components` barrel and all 93 importing statements measured on `main` (79 of them outside the test trees) stay untouched. The two heaviest consumers are deep-path rather than barrel — `ui-breakpoints` (28) and `ui-color-theme` (22) — which is exactly why the seam has to hold at the path level.

**Thin adapters, only where the toolkit would regress shipped behaviour.** Three seams are adapters over a toolkit component, each traceable to a committed regression test; `ui-text-field-form` is listed with them because it also keeps local logic, but it is a local composite that wraps the toolkit-backed primitives rather than an adapter over a toolkit component, so it sits outside the adapter count:

| Seam | Local logic kept | Why it cannot be dropped |
| --- | --- | --- |
| `ui-link` | `resolveExternalLinkRel` (case-folds `target`), localized `newTabLabel` | The toolkit compares `target === '_blank'` strictly, so `_BLANK` opens a real new tab carrying no `rel` (#382 F2) |
| `ui-input` | `buildInputSlotProps` (`slotProps.htmlInput`) | The toolkit exposes no `describedBy`/`required` seam, so `aria-describedby`/`aria-required` stop reaching the `<input>` (#382 F3) |
| `ui-button` | Falsy-`href` drop, `rel`/`target` prop declarations | A falsy `href` must not turn a `<button>` into a destination-less `<a>`; the toolkit forwards `rel`/`target` at runtime but omits them from its type |
| `ui-text-field-form` | `Controller`, `composeDescribedBy`, `isRequiredRule`, live-region `FieldMessage` | Richer than the toolkit's equivalent; it composes the toolkit-backed `UiInput`/`UiTypography` instead of being replaced |

**Self-hosted `woff2` under the real family names.** The toolkit's build requests `fontFamily:"Inter"` 36 times and `fontFamily:"Golos Text"` 22 times; a `next/font`-generated name can never satisfy either, so left alone every toolkit component renders in a fallback face. `styles/global.css` declares those faces against the `.woff2` assets already in the repository (472,032 B across nine faces) with hand-written metric-adjusted fallbacks, and `next/font` is dropped. Importing the toolkit's own `styles.css` is rejected: it ships `.ttf` totalling 1,348,788 B against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger). `_fonts.scss` stops hardcoding generated hashes and names the real families instead, which removes the silent breakage described above.

**Jest resolves the ESM-only package explicitly.** The package's `exports` map declares no `require` condition, so the CJS resolver fails at resolution, not at parse. `moduleNameMapper` entries plus a `transformIgnorePatterns` allow-list entry are required in **both** `jest.config.ts` and `jest.mutation.config.ts` — the mutation config is what Stryker's in-process runner loads, and this repository has already been bitten by those two diverging.

## Target Users

| User | What they get | How success shows up for them |
| --- | --- | --- |
| **Contributors** | One place to change a shared primitive; a `Ui*` fix lands once and reaches both consumers | No "which copy is ahead?" question in a `Ui*` PR; the seam file is short enough to read in full |
| **Reviewers** | A diff that is either "re-export" or "adapter with a named reason", each adapter pointing at the regression test that justifies it | Review effort concentrates on the three adapters, the local composite and the font change, not on 1,310 deleted lines |
| **End users of `/` and `/swagger`** | The toolkit's accessibility work (tooltip keyboard operation, checkbox `aria-invalid`) without losing this site's hardening, and unchanged rendered typography | No perceptible visual change; WCAG 2.1 AA holds at all three enforcement layers |
| **The CRM sister repo** | A migration already proven against a real consumer, with upstream gaps filed rather than worked around twice | VilnaCRM-Org/crm#250 inherits the adapter list instead of rediscovering it |

End users are the constraint-setting group: they are the only ones this change can harm, and every gate below exists to prove it does not.

## Goals and Success Metrics

Each row is checkable from CI output or a committed artifact. Relaxing a row is a failure of the change, never a way to satisfy it.

| # | Goal | Metric | Target |
| --- | --- | --- | --- |
| G1 | No gate is weakened to land this | Diff over `scripts/ci/validate-build-artifact.sh`, `config/*`, `lighthouserc*`, `playwright.config.ts`, `.claude/react-sdlc.yml`, `jest.config.ts` thresholds | 0 relaxed thresholds; 0 new suppressions (`eslint-disable`, `@ts-ignore`, `prettier-ignore`, markdownlint disable, `test.skip`, axe-rule removal) |
| G2 | The pipeline is green | `gh pr checks` on the realising PR | All checks pass, including `build-artifact`, `visual-test`, `unit`, `smoke`, `codecov` |
| G3 | Static JS stays inside budget | `scripts/ci/validate-build-artifact.sh` | Measured bytes <= 3,300,000 (currently 3,336,275, i.e. 36,275 over) |
| G4 | The integration layer holds its bar | `TEST_ENV=integration` coverage summary | 100% statements / branches / functions / lines, with every adapter branch driven |
| G5 | Client and edge layers hold their floors | `TEST_ENV=client`, `TEST_ENV=edge` | client >= 92 branches / 95 functions / 97 lines / 97 statements; edge 100% per file |
| G6 | Visual change is explained, not absorbed | One written cause per changed baseline, reviewed by the CODEOWNERS owner of `src/test/visual/**-snapshots/` | Every regenerated PNG carries a recorded cause distinguishing "the font now renders as intended" from "the page changed"; 0 blind updates |
| G7 | No accessibility or security assertion is removed | Diff over `src/test/testing-library/**`, `src/test/a11y/**`, `tests/integration/**` | 0 deleted assertions; an assertion may move layers only with its replacement named in the same diff |
| G8 | Accessibility conformance holds | `make test-a11y` plus the interaction-state scans | 0 serious/critical and 0 unset-impact axe violations; `src/test/a11y/interaction-states.ts` registers the tooltip's new keyboard states |
| G9 | Lighthouse floors hold | `lighthouserc.desktop.js` / `lighthouserc.mobile.js` | Category and byte assertions pass at the profile's raise-only floors (85 desktop / 40 mobile) |
| G10 | The dependency is verifiable offline | A committed digest plus a check that reads it | The tarball's SHA-256 is committed and verified; the version is pinned once, not restated |

G3, G6 and G10 are the three the current attempt does not meet. G10 has no CI signal at all today, which is why it is stated as a goal rather than assumed.

## MVP Scope

### In scope

The nine `src/components/ui-*` modules the research confirms are changed, plus the supporting work each one forces:

| Module | Treatment |
| --- | --- |
| `ui-color-theme` | Re-export `websiteColorTheme as UiColorTheme` |
| `ui-breakpoints` | Re-export `websiteBreakpointsTheme as UiBreakpoints` |
| `ui-typography` | Re-export; ARIA flows via `...rest` |
| `ui-checkbox` | Re-export; local `styles.ts` / `types.ts` retire |
| `ui-toolbar` | Re-export; local `theme.ts` retires |
| `ui-tooltip` | Re-export; `tooltip-wrapper.tsx` retires, keyboard states gained |
| `ui-button` | Adapter (falsy `href`, `rel`/`target` types) |
| `ui-link` | Adapter (`resolveExternalLinkRel`, localized `newTabLabel`) |
| `ui-input` | Adapter (`buildInputSlotProps`) |

Supporting work: the `styles/global.css` `@font-face` declarations and fallback metrics; dropping `next/font` and rewriting `_fonts.scss` to the real family names; the Jest and Stryker resolver mappings; a shared i18n key for the new-tab cue; rewritten Storybook stories against the seams, with `.storybook/preview.ts` importing the global stylesheet and the dead `staticDirs` font block removed; the committed tarball digest and its check; and the spec updates the seam changes force.

### Out of scope

- **Rewriting `UiTextFieldForm` onto the toolkit's equivalent.** The local version is strictly richer (live-region errors, `composeDescribedBy`, `isRequiredRule`); it composes the toolkit-backed primitives and stops there.
- **`UiImage`.** It depends on `next-export-optimize-images`, which the toolkit cannot provide, so it stays local and untouched. The PR narrative listing it among the swapped primitives is a description error, not a scope item — `UiInput` is the ninth changed module.
- **Fixing the toolkit.** The five upstream gaps are filed, not fixed here; this change must land against `v0.3.0` as published.
- **The CRM migration.** VilnaCRM-Org/crm#250 is blocked on its own React 19 / MUI 9 upgrade and is tracked separately.
- **Adopting toolkit components this site does not already have.** The scope is replacing duplicates, not importing new surface area — which is also what keeps the bundle argument honest.

## Constraints and Assumptions

**C1 - Supply chain: the lockfile proves nothing here.** `bun.lock` records a remote tarball as the 2-element `[spec, {peerDependencies}]` form with **no `sha512`**, unlike every registry entry beside it, and `Dockerfile:21` runs `bun install --frozen-lockfile` in the `base` stage, so every dev-image build and every BuildKit cache miss refetches the asset from `github.com` unverified. A GitHub release asset is mutable by anyone with upstream push access, and `config/osv-scanner.toml`'s differential scan cannot key a remote-tarball entry to an ecosystem/package pair, so the dependency sits outside SCA coverage entirely.

> Assumption: a committed SHA-256 digest plus a check that verifies it is a hard requirement of this change, modelled on `contracts/user-service/checksums.json` and `make lint-contracts` (#376), with a single `UI_TOOLKIT_VERSION` pin in `.env` modelled on `USER_SERVICE_VERSION`. The toolkit's `CONSUMING.md` claim that the lockfile hash makes the pin tamper-evident is false as written and must not be relied on.

**C2 - Font payload is capped by budgets that may not be raised.** The repository already ships 472,032 B of `.woff2`. The toolkit's `styles.css` would add 1,348,788 B of `.ttf` against desktop `totalBytes` ceilings of 1,550,000 and 1,450,000. Self-hosted `woff2` under the real family names is therefore the only viable mechanism, and the fallback metric overrides (`size-adjust`, `ascent-override`, `descent-override`) are derived data carrying a recompute rule, not constants to be copied forward.

**C3 - Visual baselines are CODEOWNERS-protected on purpose.** `playwright.config.ts` sets no `maxDiffPixels` and no `threshold`, so any differing pixel fails, and `.github/CODEOWNERS` gates `src/test/visual/**-snapshots/` because an approved wrong baseline certifies itself (#344). Regeneration is an outcome of review, never an input to it.

**C4 - Storybook stories are rewritten, not deleted.** No gate requires a story to exist — `scripts/ci/mutation-scope.ts` only *excludes* `*.stories.tsx` — so deleting six of twelve story files passes CI silently while halving the reviewable design surface. That is precisely the drift #458 exists to stop.

**C5 - `uk` is the live lane.** `NEXT_PUBLIC_MAIN_LANGUAGE` is `uk`, so the `uk` screenshots are the whole live estate and the `en` baselines did not run. Any claim about visual impact must be read against the `uk` set.

> Assumption: the change is scoped to toolkit `v0.3.0` and does not wait for an upstream release. Waiting would leave the two copies drifting for the length of the toolkit's release cycle, which is the cost this change exists to stop.

## Risks and Open Questions

**R1 - Static JS is 36,275 B (1.10%) over budget.** `build/index.mjs` is a single 275.7 KB ESM module whose components share theme objects, so tree-shaking recovers far less than the component count suggests.

> Assumption: the requirement is a payload reduction, not a budget change. A bundle-analyzer diff (`make build-analyze`) against `main` is the first required artifact — the retired per-primitive `createTheme`/`ThemeProvider` calls should already have returned bytes, and any surviving `@mui/material` barrel import in a seam is the first suspect. If nothing closes 36,275 B, the change is not shippable in this form and the toolkit must ship per-component entry points first.

**R2 - 132 of 156 visual tests fail, including a 21 px height change.** `uk_largeMobile` moved from 414x1562 to 414x1541, and the desktop/tablet screens differ by ~26,756 pixels. A height change is a font-metric change, not anti-aliasing, and two mechanisms can produce it: hand-written fallback metrics differing from what `next/font` derived, or the stale `__golos_58e94b` hash having meant `/swagger` was already rendering in a fallback face on `main`.

> Assumption: the two causes must be separated before any baseline is touched, by building once with `_fonts.scss` on the old generated names and once on the new real names and diffing. If the swagger set moves under that isolation the hashes were stale and the new baselines record an intended fix; if the landing set moves the fallback metrics are wrong and must be recomputed rather than baselined. Only then is a CODEOWNERS-reviewed `make test-visual-update` legitimate.

**R3 - The failing Jest case asserts on Emotion's emitted stylesheet text.** `UiCheckBox`'s hover-token test reads `style.textContent`, which is empty whenever Emotion uses speedy insertion (`CSSStyleSheet.insertRule`) under `NODE_ENV=production` — and `make` exports `.env.production`, so a container run and a bare local run can disagree on exactly this. The selector logic itself is sound; the toolkit does emit a matching `&:hover:not(.Mui-disabled) .ui-checkbox-box` rule.

> Assumption: the fix is to read `document.styleSheets[i].cssRules`, which is populated in both insertion modes. Failing that, the hover token belongs to the Playwright layer and the unit assertion is deleted with its replacement named in the same diff — never made conditional, and never satisfied by reaching into the toolkit's exported `styles` object, which would assert the dependency rather than the app.

**R4 - Accessible names change site-wide.** Localizing `newTabLabel` appends a visually-hidden cue to every `_blank` link's accessible name, and the same strict `target === '_blank'` gate means `_BLANK` links get the hardened `rel` but no cue. Any name-based locator — e2e, a11y route sweeps, visual interaction states — is exposed to the same break.

> Assumption: the new-tab key belongs in a shared i18n namespace, not `src/features/landing/i18n/`. A shared primitive reading a feature bundle is boundary erosion that `no-shared-layers-to-features` cannot catch, because the coupling runs through i18next's flat resource merge rather than through an import.

**R5 - Prop surfaces widen where they were deliberately narrow.** `UiInputProps` would go from a hand-written 13-prop allow-list with documented `name`/`autoComplete` rationale to the whole of `TextFieldProps` minus three keys; `UiTypographyProps` loses its closed `component` union for `ElementType` and its explicit ARIA allow-list for `...rest`.

> Assumption: accepted for `UiTypography` (the ARIA props still arrive, and the closed union was a local convention), and **not** accepted for `UiInput`, whose narrow surface is the #382 F3 artefact that keeps `required` from reaching the DOM as a native attribute. `UiInputProps` stays an explicit allow-list over the toolkit type rather than an `Omit`.

**R6 - Storybook renders in a fallback face after the change.** `.storybook/preview.ts` imports no stylesheet, and `.storybook/main.ts` copies the nine `.woff2` into `staticDirs` for a mechanism that no longer exists.

> Assumption: `.storybook/preview.ts` imports `styles/global.css` and the dead `staticDirs` block is removed in the same change, alongside the rewritten stories required by C4. Otherwise `storybook build` ships a design surface that no longer matches production.

**R7 - Three toolkit style objects request a bare `Golos` family for which no `@font-face` exists** in `styles/global.css` or in the toolkit's own `index.css`.

> Assumption: unreachable from this site today, because none of the toolkit's form-level components is consumed, so not a blocker — but it is a sixth upstream-gap item, filed alongside the five below, because adopting any of those components later would silently fall back.

**R8 - Mutation legs are unaffected but must still resolve.** No `ui-*` file is in the curated list or matches `config/mutation-policy.json`'s `mutableDirectories`, so nothing this change touches is mutated. The `jest.mutation.config.ts` mapping is still mandatory so that *other* mutants' related specs, which transitively import `@/components`, can load at all — a resolution failure there reads as an all-survived result indistinguishable from genuinely weak tests.

## Post-MVP

The adapters are debt with a named payoff: each exists because of a specific upstream defect, and each retires when that defect is fixed and the pin moves.

| Upstream gap | Adapter it keeps alive | Retires when |
| --- | --- | --- |
| 1. `UiLink`'s `rel` hardening compares `target === '_blank'` strictly — a real security bug, which also suppresses the new-tab cue for `_BLANK` | `ui-link` | Upstream case-folds `target` before comparing |
| 2. The exported `Ui*Props` set excludes exactly the interfaces this repo consumes (the toolkit's own build warns `ae-forgotten-export`); `ComponentProps<typeof X>` is the correct workaround meanwhile | `ui-button` and `ui-input` types | Upstream exports the consumed interfaces |
| 3. Font families are hardcoded rather than tokenized, so a consumer cannot supply its own optimized fonts | The whole `styles/global.css` mechanism | Upstream accepts a font-family token |
| 4. `newTabLabel` defaults to hardcoded English `(opens in new tab)`, wrong for a bilingual site | `ui-link`'s `useTranslation()` wiring | Upstream defaults to no label, or accepts a resolver |
| 5. Optional props omit `\| undefined`, which breaks under `exactOptionalPropertyTypes` | The conditional-spread construction in `ui-link` | Upstream widens optional prop types |

Gap 6, added by the research rather than the issue: the bare `fontFamily:"Golos"` references described in R7.

Beyond the adapters: revisit `UiTextFieldForm` once the toolkit's equivalent carries live-region errors and `composeDescribedBy`; contribute the website's hardening upstream so the CRM inherits it instead of reimplementing it; and, if R1 cannot be closed by trimming, push for per-component entry points so the bundle cost scales with what is actually used rather than with the whole package.
