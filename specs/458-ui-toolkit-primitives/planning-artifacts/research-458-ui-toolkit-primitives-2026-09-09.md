---
stepsCompleted:
  - step-01-inventory-current-primitives
  - step-02-map-call-sites-and-public-api
  - step-03-trace-font-pipeline-end-to-end
  - step-04-enumerate-test-and-gate-surface
  - step-05-inspect-the-toolkit-artifact
  - step-06-derive-repository-policy-constraints
  - step-07-quantify-risks-and-resolve-open-questions
inputDocuments:
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - scratchpad/pr459.diff (full PR diff, +408 / -1310)
  - scratchpad/pr459-visual.log (visual-tests CI log, run 33850692145)
  - origin/main tree at bad33bca
  - node_modules/@vilnacrm/ui-toolkit@0.3.0 (installed locally, build/ inspected)
  - CLAUDE.md, AGENTS.md, .claude/react-sdlc.yml
workflowType: research
classification:
  projectType: frontend-dependency-migration
  domain: shared-ui-primitives-and-font-pipeline
  complexity: medium-high
  projectContext: brownfield-retrospective
status: Draft
---

# Research - Wire `@vilnacrm/ui-toolkit` into the website (#458 / PR #459)

**Author:** BMad Analyst **Date:** 2026-09-09 **Source:** [website#458](https://github.com/VilnaCRM-Org/website/issues/458), [PR #459](https://github.com/VilnaCRM-Org/website/pull/459)

## Executive Summary

`src/components/ui-*` in this repository and the components in `@vilnacrm/ui-toolkit` are two implementations of one design: the toolkit was extracted from this codebase and has since gained accessibility work the website lacks, while the website has gained security and accessibility fixes (#382 F2/F3) the toolkit lacks. PR #459 replaces the local implementation of nine `src/components/ui-*` modules with the toolkit's, keeping each `@/components/...` path as an import seam so no call site moves.

Three findings from reading `origin/main`, the PR diff and the installed package materially change how the change should be specified.

1. **The migration is not a like-for-like swap; it is a swap plus a font-pipeline rewrite, and the font rewrite is the part that breaks CI.** The toolkit's themes request the families by their real names — `fontFamily:"Inter"` appears 36 times and `fontFamily:"Golos Text"` 22 times in `build/index.mjs` — while this repo declares them through `next/font/local`, which mints an opaque per-import family name. Those two facts cannot both hold, so `next/font` had to go. Replacing it changes what every page paints.
2. **The visual blast radius is an order of magnitude larger than the PR and the CI summary report.** `scratchpad/pr459-visual.log:7514` reads `132 failed` against `24 passed` out of 156 tests: every `uk` screenshot of all four visual specs (`swaggerComparison`, `visualComparison`, `visualNotificationError`, `visualNotificationSuccess`) on all three browsers, not the three swagger snapshots named in the CI digest. `uk_largeMobile` changed height from 1562 px to 1541 px — a 21 px layout change, not anti-aliasing.
3. **The dependency arrives with no local integrity check and no gate that would notice.** `bun.lock` records the remote tarball as the 2-element form `[spec, {peerDependencies}]` with no `sha512`, and `Dockerfile:21` runs `bun install --frozen-lockfile` inside the `base` stage, so every dev-image build fetches `github.com/.../vilnacrm-ui-toolkit-0.3.0.tgz` unverified. The repository already solved this exact problem for the user-service contracts (`contracts/user-service/checksums.json`, #376) and that precedent is unapplied here.

The PR is currently red on four checks: `build-artifact` (static JS 3,336,275 B against a 3,300,000 B budget), `visual-test`, `unit`/`smoke` (one Jest case), and `codecov` downstream of unit. None of them can be cleared by relaxing a threshold; each has a root-cause fix identified below.

## Current State (per component)

Every path below is `src/components/<dir>/` on `origin/main` unless stated. "PR" describes what `scratchpad/pr459.diff` does to it.

| Primitive | On `main` today | Behaviour that must survive | Specs asserting it | PR outcome |
| --- | --- | --- | --- | --- |
| `ui-button` | MUI `Button` under a local `ThemeProvider`; explicit prop list plus `...rest`; `href` dropped when falsy (`hrefProps = href ? { href } : {}`); `types.ts` = `ButtonProps & { rel?, target? }` | Falsy `href` must not turn the `<button>` into a destination-less `<a>`; `rel`/`target` type-declared | `src/test/testing-library/UiButton.test.tsx`; new `tests/integration/coverage/misc-small/ui-toolkit-adapters.integration.test.tsx` | **Adapter.** Renders `ToolkitUiButton`; re-adds the falsy-`href` drop and the `rel`/`target` prop declarations over `ComponentProps<typeof UiButton>` |
| `ui-typography` | MUI `Typography`; props forwarded through an **explicit allowlist** with `aria-live`/`aria-atomic` named for the #382 F3 live region; `types.ts` pins `component` to a closed union (`UiTypographyTextTag \| UiTypographyHeadingTag`) | `aria-live`/`aria-atomic` reach the element; `component` cannot be an arbitrary element | `UiTypography.test.tsx`, `UiTextFieldForm.test.tsx` (live-region path) | **Straight re-export.** `types.ts` deleted. Toolkit type is `UiTypographyProps extends HTMLAttributes<HTMLElement>` with `component?: ElementType` — ARIA now flows via `...rest`, but the closed `component` union is gone |
| `ui-checkbox` | `FormControlLabel` wrapping a **styled native `<input type="checkbox">`** inside a `Box`; `styles.ts` holds `1.5rem`/`0.5rem`/`grey400`/`error` tokens and the `&:hover` border; `aria-invalid` on error | Label association, disabled, controlled `checked`, `aria-invalid`, the border tokens | `UiCheckBox.test.tsx` (7 cases incl. `expectNoA11yViolations`) | **Straight re-export.** `styles.ts` and `types.ts` deleted. Toolkit renders MUI's control with `icon={<span className="ui-checkbox-box"/>}` and hover styling at `&:hover:not(.Mui-disabled) .ui-checkbox-box`; adds `required` and `helperText` |
| `ui-link` | MUI `Link`; `rel` computed by the shared `resolveExternalLinkRel` (`src/shared/externalLinkRel.ts`), which **case-folds** `target` before comparing to `_blank` | `_BLANK` must be hardened; caller `rel` tokens merged, not replaced | `UiLink.test.tsx` (6 cases, incl. "hardens a case-variant blank target"); `tests/integration/coverage/shared/external-link-rel.integration.test.ts` | **Adapter.** Renders `ToolkitUiLink`, keeps `resolveExternalLinkRel`, and localizes `newTabLabel` via `useTranslation()` |
| `ui-input` | MUI `TextField`; `buildInputSlotProps` puts `aria-describedby`/`aria-required` on `slotProps.htmlInput` so they land on the `<input>`, not the FormControl; `types.ts` is a **narrow hand-written allowlist** with documented `name`/`autoComplete` (#382 F3) | `aria-describedby` reaches the `<input>`; `required` emits ARIA only, never the native attribute | `UiInput.test.tsx:68`, `AuthForm.test.tsx:353-356` (`password-requirements`), `UiTextFieldForm.test.tsx` | **Adapter.** Renders `ToolkitUiInput`, keeps `buildInputSlotProps`. `types.ts` becomes `Omit<ComponentProps<typeof UiInput>, 'ref' \| 'slotProps' \| 'required'>` — i.e. the full `TextFieldProps` surface |
| `ui-toolbar` | MUI `Toolbar` under a local theme; children only | Layout only | `UiToolbar.test.tsx` | **Straight re-export**; `theme.ts` deleted |
| `ui-tooltip` | `index.tsx` + `tooltip-wrapper.tsx`: click-toggle, `ClickAwayListener`, `useCloseOnBreakpointChange` derived during render (deliberately not an effect) | Toggle both directions, click-away, breakpoint reset | `UiTooltip.test.tsx`, `UiTooltipWrapper.test.tsx`, `tests/integration/coverage/misc-small/tooltip-wrapper.integration.test.tsx` | **Straight re-export**; `tooltip-wrapper.tsx` and `theme.ts` deleted. Toolkit adds Enter/Space/Escape, `role="button"`, `aria-expanded`, `aria-controls`, `triggerLabel` |
| `ui-color-theme` | `createTheme` with 24 palette tokens | Every token value | Consumed by 22 deep imports | **Straight re-export** of the toolkit's `websiteColorTheme as UiColorTheme` |
| `ui-breakpoints` | `createTheme` with xs 375 / sm 640 / md 768 / lg 1024 / xl 1440 | Exact values | Consumed by 28 deep imports | **Straight re-export** of `websiteBreakpointsTheme as UiBreakpoints` |
| `ui-image` | MUI `Box` + `next-export-optimize-images/image`, fixed 80x80 | Export-time image optimisation | `UiImage.test.tsx` | **Untouched.** No `src/components/ui-image/*` path appears in `pr459.diff` |
| `ui-text-field-form` | `Controller` + `composeDescribedBy` + `isRequiredRule` + unconditionally-rendered `aria-live="polite"` `FieldMessage` | All of it (#382 F3) | `UiTextFieldForm.test.tsx`, `tests/integration/coverage/ui-form-primitives/` | **Kept local**, now composing the toolkit-backed `UiInput`/`UiTypography` |

### The "91 call sites" claim

Measured on `origin/main` across `src/`, `pages/` and `tests/`:

```bash
git grep -h -E "from '@/components" origin/main -- src pages tests   # 138 import statements total
```

Of those, **93 import statements** name one of the nine primitives the PR lists (101 named-symbol references, since one line can name several); **79** sit outside `src/test/` and `tests/`. So `91` is directionally right but not exactly reproducible from `main`; the load-bearing claim — that the seam leaves them all untouched — holds, because every changed file is `src/components/ui-*/index.*` or `types.ts`. The two largest consumers are deep-path, not barrel: `@/components/ui-breakpoints` (28) and `@/components/ui-color-theme` (22 — the PR's re-export comment says 21).

### Discrepancies between the PR narrative and the diff

- The PR lists `UiImage` among the swapped primitives. It is not swapped; `UiInput` is the ninth changed module. `UiImage` correctly stays local, because the toolkit cannot provide `next-export-optimize-images`.
- The PR says `UiInput` and `UiLink` are "kept local". They are **adapters over the toolkit component**, not local implementations. The behaviour contract is preserved; the rendering path is not.
- `UiTooltipWrapper.test.tsx` now imports `WrapperUiTooltip from '@/components/ui-tooltip'` — the wrapper concept is gone, only the spec's local alias survives.

## Font Pipeline

### Today, on `main`

```text
src/assets/fonts/Inter/*.woff2   (3 faces, 316,144 B)
src/assets/fonts/Golos/*.woff2   (6 faces, 155,888 B)   -> 472,032 B total
        |
        v
src/config/Fonts/inter.ts, golos.ts   -- next/font/local, display: 'swap'
        |
        +-- pages/_app.tsx:67          <main className={golos.className}>
        +-- ui-button/theme.ts         golos.style.fontFamily  (x3)
        +-- ui-input/theme.ts          inter.style.fontFamily
        +-- ui-link/theme.ts           inter.style.fontFamily
        +-- ui-typography/theme.ts     golos x6 / inter x2
        +-- landing styles.ts, styles.success.ts
        |
        v
src/features/swagger/.../variables/fonts/_fonts.scss
        $golos: __golos_58e94b, __golos_Fallback_58e94b;
        $inter: __inter_74e140;
```

The SCSS line is the sharpest smell on `main`: it **hardcodes `next/font`'s generated family hashes**, by hand, in a file last touched by the #225 kebab-case rename and originally authored in #29. `next/font` derives that name from the loader options and file paths, so any change to `golos.ts` silently invalidates it and nothing in the repo checks it. `$golos`/`$inter` feed `_ui-typography.scss` and `styles.scss:9`, i.e. the entire `/swagger` typography.

### What the toolkit forces

`node_modules/@vilnacrm/ui-toolkit/build/index.mjs` contains, verbatim:

| Reference | Count |
| --- | --- |
| `fontFamily:"Inter"` | 36 |
| `fontFamily:"Golos Text"` | 22 |
| `fontFamily:"'Golos Text'"` | 2 |
| `fontFamily:"Golos"` (bare, no "Text") | 3 |

A `next/font`-generated name can never satisfy any of these. Two options exist and the PR picks the second:

- Import `@vilnacrm/ui-toolkit/styles.css`. It carries 9 `@font-face` rules pointing at `.ttf` files shipped in the package: **1,348,788 B** (Inter 303-309 KB/face, Golos 66 KB/face). That is +1.29 MiB of font payload on top of the 472 KB of `.woff2` already shipped, against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger) in `lighthouserc.desktop.js`. Not viable. (The PR says "~1.6 MB"; the measured figure is 1.29 MiB.)
- Declare `Inter` and `Golos Text` under their real names in `styles/global.css` against the existing `.woff2`, drop `next/font`, and hand-write the metric-adjusted fallbacks `next/font` used to generate. This is what the PR does: 9 `@font-face` rules, two `*-Fallback` faces over `local('Arial')` with `size-adjust`/`ascent-override`/`descent-override`, an `.app-typeface` class applied at `pages/_app.tsx`, a `GOLOS_TEXT_FAMILY` constant in the new `src/config/Fonts/families.ts`, and `_fonts.scss` rewritten to `'Golos Text', sans-serif` / `'Inter', sans-serif`.

### Edge and export consequences

Global CSS `url('../src/assets/fonts/...')` is resolved by Next's css-loader and emitted under `out/_next/static/media/`, the same destination `next/font` used. `scripts/cloudfront_routing.js` allows `_next` in `ALLOWED_DIRS` and `woff2` in `ALLOWED_EXTENSIONS`, so `scripts/ci/verify-edge-allowlist.mjs` is unaffected and no allow-list widening is needed. This is the one gate the font change does *not* touch.

`.storybook/preview.ts` imports no stylesheet at all, and `.storybook/main.ts` copies the nine `.woff2` into `staticDirs` for a mechanism that no longer exists. After the PR, Storybook renders every toolkit component in a fallback face and the `staticDirs` block is dead config.

> Assumption: the second option is correct and the specs should require it. The first breaks a Lighthouse budget that may not be raised; a third option — tokenizing the toolkit's font families — is upstream work (#458 upstream gap 3) and cannot gate this change. The `styles/global.css` route is therefore the requirement, and the metric-override values must be treated as derived data with a recompute rule, not as magic constants.

> Assumption: `.storybook/preview.ts` must import `styles/global.css` and the dead `staticDirs` block must be removed in the same change. Without it, `storybook build` ships a design surface that no longer matches production, which is precisely the drift #458 exists to stop.

## Test and Gate Surface

### Jest layers

`jest.config.ts` selects a layer by `TEST_ENV`; the ones this change touches:

| Layer | Glob | Coverage contract |
| --- | --- | --- |
| `client` | `src/test/testing-library/**`, `src/test/unit/**` | floors 92 branches / 95 functions / 97 lines / 97 statements |
| `integration` | `tests/integration/**/*.integration.test.{ts,tsx}` | **global 100%** across `src/**` minus types/theme/styles/stories/mocks, `babel` provider |
| `edge` | `src/test/edge/**` | 100% on the three shipped runtime scripts |

Seventeen `src/test/testing-library/Ui*.test.tsx` files exist; the PR edits six of them plus `AuthFormPolicyLinks.test.tsx`, and adds `tests/integration/coverage/misc-small/ui-toolkit-adapters.integration.test.tsx` (140 lines, 10 cases) to hold the two adapters at the integration layer's 100% bar.

### Why an ESM-only dependency needs mapping

`@vilnacrm/ui-toolkit`'s `exports` map is:

```json
{ ".": { "types": "./build/index.d.ts", "import": "./build/index.mjs" },
  "./styles.css": "./build/index.css" }
```

There is **no `require` condition**. Jest's CJS resolver therefore cannot resolve the bare specifier at all — it fails at resolution, not at parse. The PR adds to `moduleNameMapper` in both `jest.config.ts` and `jest.mutation.config.ts`:

```ts
'^@vilnacrm/ui-toolkit$': '<rootDir>/node_modules/@vilnacrm/ui-toolkit/build/index.mjs',
'^@vilnacrm/ui-toolkit/styles\\.css$': '<rootDir>/node_modules/@vilnacrm/ui-toolkit/build/index.css',
```

and extends the ESM allow-list `'/node_modules/(?!(uuid|@faker-js/faker|@vilnacrm/ui-toolkit)/)'` in both, so babel-jest transforms the `.mjs`. Both files are required: `jest.mutation.config.ts` is what Stryker's in-process Jest runner loads, and this repository has already been bitten by that config diverging (see the alias-blindness note under Risks).

### Gates the change must satisfy

| Gate | Where enforced | Bearing on this change |
| --- | --- | --- |
| Static JS byte budget | `scripts/ci/validate-build-artifact.sh:83` — `js_budget=3300000`, called only from `.github/workflows/build-artifact.yml:39` | **Red: 3,336,275 B, +36,275 over (1.10%).** The script's own comment records the budget as "current actual (~3.13 MB) + ~5% headroom; never raise it" |
| Visual regression | 234 committed PNGs under `src/test/visual/**-snapshots/`; `playwright.config.ts` sets **no** `maxDiffPixels` and **no** `threshold`, so Playwright's defaults apply and any differing pixel fails | **Red: 132/156.** Baselines are CODEOWNERS-protected (`.github/CODEOWNERS:35-36`, `@Kravalg`) precisely because an approved wrong baseline certifies itself |
| Lighthouse budgets | `lighthouserc.desktop.js` / `.mobile.js` via `assertMatrix`; desktop homepage `scriptBytes` 750000 / `totalBytes` 1550000, swagger 1050000 / 1450000; profile floors 85 desktop / 40 mobile | Not currently red, but the same bytes that blew the static-JS budget count here; the `.ttf` alternative would have breached `totalBytes` outright |
| Integration 100% | `jest.config.ts` `INTEGRATION_COVERAGE_THRESHOLD` | Every branch of both adapters must be driven — hence the 10-case adapter spec |
| Mutation | `stryker.config.mjs` curated list is 4 files (two `validations/`, `normalizeLink.ts`, `useSwagger.ts`) — **no `ui-*` file**. `config/mutation-policy.json` `mutableDirectories` is `api/helpers/hooks/utils/validations`, and `src/components/ui-*` matches no such path segment | The `curated` and `changed` legs do not mutate any file this PR edits. The mutation configs still need the resolver mapping so unrelated mutants' related tests can load |
| dependency-cruiser | `.dependency-cruiser.js`: `no-orphans`, `not-to-dev-dep`, `components-kebab-case`, `no-shared-layers-to-features` | `@vilnacrm/ui-toolkit` is in `dependencies`, so `not-to-dev-dep` is clean. `src/config/Fonts/families.ts` has two importers, so no orphan. `src/config/Fonts` keeps its capital F legally — `components-kebab-case` is scoped to `^src/(?:components\|features/[^/]+/components)/` |
| `lint-pins` | `scripts/ci/check-version-pins.mjs` | Covers Node/Bun/Playwright only; a tarball dependency is invisible to it |
| osv-scanner | `config/osv-scanner.toml`, differential on `bun.lock` | A remote-tarball entry carries no registry coordinates, so OSV has nothing to match — the new dependency is **outside SCA coverage entirely** |
| `make lint-md` / Prettier / qlty | `MD_LINT_ARGS` excludes `specs/**`; `.prettierignore:34` excludes `/specs/`; `.qlty/qlty.toml:39` excludes `**/specs/**` | These planning artifacts are unlinted; product Markdown is not |

## Toolkit Package Facts

Verified against the installed `node_modules/@vilnacrm/ui-toolkit` (version `0.3.0`, `packageManager: bun@1.3.5`).

- **Distribution.** `files: ["build"]`; `build/` totals 3,091,670 B — `index.mjs` 275.7 KB, `index.d.ts` 109.7 KB, `index.css` 8.8 KB, `index.mjs.map` 1.3 MB, plus 9 `.ttf` at 1,348,788 B. `sideEffects: ["**/*.css"]`, so the JS is declared tree-shakeable.
- **Peer dependencies** (9): `@emotion/react`, `@emotion/styled`, `@mui/material` `^9`, `@mui/system` `^9`, `react` `^19`, `react-dom` `^19`, `react-hook-form` `^7`, `i18next` `>=23 <27`, `react-i18next` `>=14 <18`. All are satisfied by this repo's existing tree.
- **Why not a git ref.** Every entry point resolves into `build/`, which upstream gitignores, and bun does not install a git dependency's devDependencies, so the `prepare: husky` script cannot rebuild it (`command not found`, exit 127). The release tarball is the only workable pin. `bun.lock` records it as `["@vilnacrm/ui-toolkit@https://…/v0.3.0/vilnacrm-ui-toolkit-0.3.0.tgz", { peerDependencies: {…} }]` — the 2-element remote form, **no `sha512`**, unlike every registry entry beside it.
- **Prop types.** 11 `Ui*Props` interfaces are exported (`UiActionIconBarProps`, `UiFilterChipProps`, `UiIntegrationCardProps`, `UiItemRowProps`, `UiItemsListProps`, `UiNotificationBadgeProps`, `UiPaymentOptionCardProps`, `UiPinInputProps`, `UiProfileSelectCardProps`, `UiStatusBadgeProps`, `UiTaskCardProps`). **None of the six this repo consumes is** — `UiButtonProps`, `UiCheckboxProps`, `UiImageProps`, `UiInputProps`, `UiLinkProps`, `UiTooltipProps` and `UiTypographyProps` are all `declare interface` without `export`. The issue's blanket "no prop types are exported" is over-broad; the precise defect is that the exported set excludes exactly the consumed set. The PR's workaround, `ComponentProps<typeof X>`, is the correct one.
- **Theme exports.** `websiteBreakpointsTheme as UiBreakpoints` and `websiteColorTheme as UiColorTheme` are aliased exports, alongside `crmColorTheme`/`crmBreakpointsTheme` and a shared `sharedPalette`. The package is multi-tenant by design, which is what makes the seam viable.
- **`UiLink` `rel` hardening is case-sensitive.** From `build/index.mjs`:

```js
function vC({children:e,href:t,target:n,rel:r,sx:o,newTabLabel:i="(opens in new tab)"}){
  let s=n==="_blank",
      a=s?Array.from(new Set([...r?.split(/\s+/).filter(Boolean)??[],"noopener","noreferrer"])).join(" "):r;
```

`n==="_blank"` is a strict comparison against an HTML keyword the spec matches ASCII-case-insensitively. `_BLANK` opens a real new tab with no `rel` — the reverse-tabnabbing case `src/test/testing-library/UiLink.test.tsx` already regression-tests. It is a genuine security defect, not a consumer inconvenience.

- **`newTabLabel` defaults to a hardcoded English `(opens in new tab)`,** rendered in a visually-hidden span. The same `n==="_blank"` gate controls whether it renders, so the label is *also* dropped for `_BLANK` — the PR's adapter hardens `rel` for that case but cannot restore the cue. `ui-toolkit-adapters.integration.test.tsx` documents this by asserting the `_BLANK` link's name is the bare label.
- **`UiCheckbox` is a superset.** It renders MUI's control with `icon={<span className="ui-checkbox-box"/>}`, hover styling at `"&:hover:not(.Mui-disabled) .ui-checkbox-box":{cursor:"pointer",borderColor:primary}`, `slotProps.input['aria-invalid']`, and adds `required` and `helperText` (rendered into a `FormHelperText` linked by `aria-describedby`). Design tokens match the local `styles.ts` exactly — same `1.5rem` box, `0.5rem` radius, `grey400`/`error` borders, same check SVG.
- **`UiInput` has no ARIA seam of its own.** Its type is `Omit<TextFieldProps,'inputRef'|'onBlur'|'onChange'> & {…}`; there is no `describedBy`, and a `required` passed through would reach the DOM as the native attribute. The website's `slotProps.htmlInput` route survives only because the toolkit forwards `slotProps` unmodified.
- **`UiTypography`** is `extends HTMLAttributes<HTMLElement>` with `component?: ElementType` — strictly wider than the local closed union.
- **`exactOptionalPropertyTypes`.** Optional props are declared `x?: T`, not `x?: T | undefined`, which is why the PR's `UiLink` adapter builds `target`/`rel` by conditional spread rather than passing them directly.

## Constraints Derived from Repository Policy

These are non-negotiable and every one of them is written down in `CLAUDE.md` or in the gate's own source.

1. **No threshold may be lowered and no gate suppressed.** `js_budget=3300000` says "trim imports (do not raise the budget)". `.claude/react-sdlc.yml` `quality.*` are raise-only, with `visual_diffs: 0`, `eslint_errors: 0`, `tsc_errors: 0`, `depcruise_violations: 0`. No `eslint-disable`, `@ts-ignore`, `prettier-ignore`, markdownlint disable, `test.skip`, or axe-rule removal.
2. **Visual baselines are reviewed, never blind-updated.** They are CODEOWNERS-protected because a wrong approved baseline is self-certifying (#344). A regeneration must be justified image-by-image, and the justification must distinguish "the font now renders as intended" from "the page changed".
3. **WCAG 2.1 AA is enforced per rule at three layers** — `jest-axe` components, `@axe-core/playwright` routes (`src/test/a11y/routes.ts`), and interaction states (`src/test/a11y/interaction-states.ts`). The toolkit's `UiTooltip` introduces new interaction states (keyboard toggle, `aria-expanded`) which belong in that registry; a unit test fails if the registry drifts from the e2e specs.
4. **Public-API seam.** `src/components/index.ts` and each `ui-*/index` are the only import surfaces; `no-shared-ui-to-features` forbids a shared primitive importing a feature.
5. **The supply-chain precedent already exists.** `contracts/user-service/` carries a committed `checksums.json`, `make lint-contracts` verifies each artifact's SHA-256, and the Apollo mock refuses a schema whose digest does not match (#376). The same shape applies to a release tarball.
6. **`.env` holds exactly one upstream version variable per contract** (`make lint-api-versions`). A toolkit version pin should follow that convention rather than living only in `package.json`.

## Risks and Open Questions

### R1 - Static JS budget (blocking, `build-artifact`)

3,336,275 B against 3,300,000 B: **36,275 B, 1.10% over**. `build/index.mjs` is a single 275.7 KB ESM module whose components share theme objects, so tree-shaking recovers less than the module count suggests. Dropping `next/font` returns some JS, but not enough.

> Assumption: the requirement is a payload reduction, not a budget change. Two levers are available without touching the budget: (a) import the nine primitives from deep entry points if the toolkit gains them (upstream work), or (b) drop the local `theme.ts` files' now-dead MUI `createTheme` calls and verify no `@mui/material` barrel import survives in the seams — the local `ThemeProvider` per primitive is gone, which should already have returned bytes, so a bundle-analyzer diff (`make build-analyze`) is the first required artifact of the fix. If neither closes 36 KB, the change is not shippable in this form and the toolkit must ship per-component entry points first.

### R2 - Visual drift (blocking, `visual-test`)

132 of 156 failed; 26,756-26,759 differing pixels (ratio 0.02) on the desktop/tablet screens; `uk_largeMobile` **changed size, 414x1562 to 414x1541**. `currentLanguage` is `process.env.NEXT_PUBLIC_MAIN_LANGUAGE` = `uk`, so the `uk` lane is the whole live estate; the `en` baselines in `visualComparison.spec.ts-snapshots/` did not run.

A 21 px height change is a metric change, not anti-aliasing. Two mechanisms can produce it: the hand-written `size-adjust`/`ascent-override` fallbacks differing from what `next/font` derived, or `_fonts.scss`'s hardcoded `__golos_58e94b` having been stale, in which case `/swagger` was rendering in a fallback face on `main` and now renders in real Golos — a genuine improvement that still invalidates the baseline.

> Assumption: the specs must require the two causes to be separated before any baseline is touched. The separation is mechanical: build once with `_fonts.scss` reverted to the `next/font` names and once with the new names, and diff. If the swagger set moves in that isolation, the hashes were stale and the new baselines are an intended fix; if the landing set moves, the fallback-metric overrides are wrong and must be recomputed rather than baselined. Only then does a CODEOWNERS-reviewed `make test-visual-update` become legitimate.

### R3 - The failing unit test asserts on Emotion's emitted stylesheet text

`src/test/testing-library/UiCheckBox.test.tsx` "keeps the hover border token on the styled box" reads `document.querySelectorAll('style')`, concatenates `textContent`, strips whitespace, splits on `}` and looks for a chunk containing `:hover` and `ui-checkbox-box`. The toolkit does emit a matching rule (`&:hover:not(.Mui-disabled) .ui-checkbox-box` with `borderColor` primary), so the selector logic is sound — which means the failure is that `textContent` is empty. Emotion's cache enables "speedy" insertion (`CSSStyleSheet.insertRule`) when `process.env.NODE_ENV === 'production'`, and in that mode a `<style>` element has no text node at all. `make` exports `.env.production`, so a container CI run and a bare local run can disagree on exactly this. The `split('}')` also mis-splits any rule nested in an at-rule.

> Assumption: the durable fix is to read `document.styleSheets[i].cssRules`, which is populated in both insertion modes, rather than `style.textContent`; failing that, the hover token belongs to the Playwright layer and the unit assertion should be deleted rather than made conditional. Reaching into the toolkit's exported `styles` object is not an option — it would assert the dependency, not the app.

### R4 - Supply chain: no integrity hash, and no gate that notices

`bun.lock` records no `sha512`; `Dockerfile:21` runs `bun install --frozen-lockfile` in the `base` stage, so every dev-image build and every BuildKit cache miss fetches the tarball from `github.com` unverified. A GitHub release asset is mutable by anyone with push access to the upstream repo. `config/osv-scanner.toml`'s differential scan cannot key a remote-tarball entry to an ecosystem/package pair, so the dependency is outside SCA coverage.

> Assumption: the specs must require a committed SHA-256 of the tarball plus a check that verifies it, modelled directly on `contracts/user-service/checksums.json` and `make lint-contracts` (#376), and a single `UI_TOOLKIT_VERSION` pin in `.env` modelled on `USER_SERVICE_VERSION`. The `CONSUMING.md` claim that the lockfile hash makes the pin tamper-evident is false as written and must not be relied on. This is a hard requirement, not a nice-to-have: it is the one risk here that has no CI signal at all.

### R5 - Accessible names change site-wide

Localizing `newTabLabel` appends a visually-hidden cue to **every** `_blank` link's accessible name. The PR already repairs `AuthFormPolicyLinks.test.tsx` (regex matcher over copy + cue) and `src/test/e2e/register-form/constants.ts` (the consent checkbox's `<Trans>` label is no longer one contiguous run, so `policyText` becomes a word-sequence `RegExp`). Any name-based locator anywhere else — e2e, a11y route sweeps, visual interaction states — is exposed to the same break.

The i18n key `accessibility.opens_in_new_tab` was added to `src/features/landing/i18n/{en,uk}.json`, i.e. a **feature** bundle consumed by a **shared** primitive.

> Assumption: the key belongs in a shared i18n namespace, not the landing feature's. `no-shared-layers-to-features` does not catch it (the coupling is through i18next's flat resource merge, not an import), which makes it exactly the kind of boundary erosion that only a written requirement prevents.

### R6 - Prop-surface widening

`UiInputProps` goes from a hand-written 13-prop allowlist with documented `name`/`autoComplete` rationale to the whole of `TextFieldProps` minus three keys. `UiTypographyProps` loses its closed `component` union for `ElementType`, and its explicit ARIA allowlist for `...rest`. Both were deliberate narrowings; both are now open.

> Assumption: this is accepted for `UiTypography` (the ARIA props still arrive, and the union was a local convention) and **not** accepted for `UiInput`, whose narrow surface is the #382 F3 artefact that keeps `required` from reaching the DOM natively. The specs should require `UiInputProps` to stay an explicit allowlist over the toolkit type rather than an `Omit`.

### R7 - Storybook regression

Six of twelve story files are deleted (`button`, `checkbox`, `link`, `toolbar`, `tooltip`, `typography`), leaving `ui-card-item`, `ui-card-list`, `ui-footer`, `ui-image`, `ui-input`, `ui-text-field-form`. No gate requires a story to exist — `scripts/ci/mutation-scope.ts:57` only *excludes* `*.stories.tsx` — so this passes CI silently while halving the design-review surface, and the surviving stories render in a fallback font (see Font Pipeline).

> Assumption: the stories should be rewritten against the toolkit-backed seams rather than deleted, and `.storybook/preview.ts` must import `styles/global.css`. Deleting them trades a reviewable design surface for a smaller diff.

### R8 - Stryker `findRelatedTests` alias-blindness

`stryker.config.mjs` runs with `enableFindRelatedTests`, and a mutable file whose related tests Jest cannot resolve produces a silent all-survived result indistinguishable from weak tests. That is why `jest.mutation.config.ts` carries its own `moduleNameMapper` — and why the toolkit mapping had to be added there too. No `ui-*` file is in the curated list or matches `mutableDirectories`, so the mutation legs are not directly at risk from this change; the mapping is needed so that *other* mutants' related specs, which transitively import `@/components`, still load.

### R9 - Untested `fontFamily:"Golos"`

Three occurrences in `build/index.mjs` request the bare family `Golos`, not `Golos Text` — in `formTitle`/`formSubtitle` style objects belonging to toolkit-internal auth components. No `@font-face` for `Golos` exists in `styles/global.css` or in the toolkit's own `index.css`.

> Assumption: these are unreachable from this site (the website consumes none of the toolkit's form-level components) so they are not a blocker, but they are a fourth upstream-gap item and should be filed alongside the five already in the issue. If any of those components is adopted later, the family will silently fall back.

## Sources

| Evidence | Path |
| --- | --- |
| Local primitives, themes, styles, types | `src/components/ui-{button,typography,checkbox,link,input,toolbar,tooltip,image,color-theme,breakpoints,text-field-form}/` |
| Public API barrel | `src/components/index.ts` |
| Shared `rel` hardening | `src/shared/externalLinkRel.ts` |
| Component specs | `src/test/testing-library/Ui*.test.tsx` (17 files) |
| Integration layer | `tests/integration/coverage/**`, incl. the new `misc-small/ui-toolkit-adapters.integration.test.tsx` |
| Font sources | `src/config/Fonts/{inter,golos}.ts`, `src/assets/fonts/{Inter,Golos}/*.woff2`, `styles/global.css`, `pages/_app.tsx` |
| Swagger font indirection | `src/features/swagger/components/api-documentation/global/variables/fonts/_fonts.scss` |
| Jest configuration | `jest.config.ts`, `jest.mutation.config.ts` |
| Static-JS budget | `scripts/ci/validate-build-artifact.sh:83-86`, `.github/workflows/build-artifact.yml:39` |
| Edge allow-list | `scripts/cloudfront_routing.js` (`ALLOWED_DIRS`, `ALLOWED_FILES`, `ALLOWED_EXTENSIONS`), `scripts/ci/verify-edge-allowlist.mjs` |
| Visual baselines and ownership | `src/test/visual/**-snapshots/` (234 PNG), `playwright.config.ts`, `.github/CODEOWNERS:28-36` |
| Visual failure evidence | `scratchpad/pr459-visual.log:1422-1660` (per-test diffs), `:7514` (`132 failed`), `:7647` (`24 passed`) |
| Lighthouse budgets | `lighthouserc.desktop.js`, `lighthouserc.mobile.js`, `lighthouserc.shared.js` |
| Mutation scope | `stryker.config.mjs`, `config/mutation-policy.json`, `scripts/ci/mutation-scope.ts` |
| Boundary rules | `.dependency-cruiser.js` (`no-orphans`, `not-to-dev-dep`, `components-kebab-case`) |
| SCA policy | `config/osv-scanner.toml` |
| Dependency pin | `package.json` (`dependencies`), `bun.lock`, `Dockerfile:19-21` |
| Toolkit artifact | `node_modules/@vilnacrm/ui-toolkit/{package.json,build/index.d.ts,build/index.mjs,build/index.css,build/*.ttf}` |
| Quality floors | `.claude/react-sdlc.yml` (`quality.*`, `capabilities.*`) |
| Repository policy | `CLAUDE.md`, `AGENTS.md`, `specs/README.md` |
