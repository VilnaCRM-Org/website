---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
lastStep: 8
inputDocuments:
  - ./prd-458-ui-toolkit-primitives-2026-09-09.md
  - ./brief-458-ui-toolkit-primitives-2026-09-09.md
  - ./research-458-ui-toolkit-primitives-2026-09-09.md
  - https://github.com/VilnaCRM-Org/website/issues/458
  - https://github.com/VilnaCRM-Org/website/pull/459 (branch feat/ui-toolkit-dependency)
  - scratchpad/pr459.diff
  - CLAUDE.md, AGENTS.md, .claude/react-sdlc.yml
workflowType: architecture
project_name: website
user_name: BMad
date: '2026-09-09'
status: Draft
---

# Architecture Decision Document - Wire `@vilnacrm/ui-toolkit` into the website (#458)

**Author:** BMad Architect **Date:** 2026-09-09 **Requirement source:** [`prd-458-ui-toolkit-primitives-2026-09-09.md`](./prd-458-ui-toolkit-primitives-2026-09-09.md) **Realised by:** [PR #459](https://github.com/VilnaCRM-Org/website/pull/459)

## Executive Summary

This architecture realises the PRD for making `@vilnacrm/ui-toolkit@0.3.0` the single design source for nine `src/components/ui-*` modules without moving a call site. Everything rests on one device — the **import seam**: `src/components/<dir>/index.{ts,tsx}` keeps its path and its default export, and its body becomes either a one-line re-export or a thin adapter. That is what leaves 93 import statements, `src/components/index.ts` and the `@landing`/`@swagger` consumers invariant, and it is what makes the change cheap to revert.

The change has two halves with very different blast radii. Nine seams and three adapters are contained and provable by specs that already exist. Replacing `next/font/local` with real-named `@font-face` declarations in `styles/global.css` changes what every page paints — 132 of 156 visual tests move and `uk_largeMobile` changed *height* (414x1562 to 414x1541). The font half is not optional: the toolkit's themes name the families literally (`fontFamily:"Inter"` 36x, `fontFamily:"Golos Text"` 22x in `build/index.mjs`) and a `next/font`-generated family name can never satisfy a literal reference.

Four decisions exist because a gate is red or blind, and each is a root-cause fix, never a relaxation: the static-JS budget (AD-10), the visual baselines (AD-11), the failing `UiCheckBox` hover assertion (AD-12, Emotion speedy insertion under `NODE_ENV=production`), and the dependency's missing integrity signal (AD-9, the `contracts/user-service/checksums.json` precedent applied to a release tarball). No decision here edits a threshold, budget, allow-list or baseline (NFR17).

## Architectural Fit Statement

Nothing here is new architecture; it slots into what the repository already is.

- **Next.js 16 pages router (`output: 'export'`), React 19, TypeScript 6, MUI 9 + Emotion, bun 1.3.5.** The toolkit's nine peer dependencies (`@emotion/react`, `@emotion/styled`, `@mui/material` `^9`, `@mui/system` `^9`, `react`/`react-dom` `^19`, `react-hook-form` `^7`, `i18next`, `react-i18next`) are already satisfied by this tree, so the swap adds one package, not a parallel UI stack.
- **Bulletproof-react layout under `src/`.** `src/components/ui-*` is already the shared-primitive layer with `src/components/index.ts` as its barrel. The seam lives inside that layer: no new top-level directory, no `src/lib/ui-toolkit/` package, and `.dependency-cruiser.js`'s `features-import-via-public-api`, `no-cross-feature-imports`, `no-shared-ui-to-features`, `no-shared-layers-to-features`, `no-orphans`, `not-to-dev-dep` and `components-kebab-case` keep meaning what they meant before.
- **`Ui*` naming and the `ui-*` directory convention.** Every seam keeps its kebab-case directory and its `Ui*` default export, so the barrel's eleven lines are byte-identical afterwards.
- **Gate-first culture.** Every decision names the gate that proves it. Where a needed gate does not exist (the tarball digest), it is created in the shape this repository already uses for the same problem rather than as a new mechanism.

The two files outside `src/` — `styles/global.css` and the swagger `_fonts.scss` — are the existing global stylesheet and the existing SCSS variable file. The font work edits them; it adds no layer.

## Decision Register

Ordered by dependency: the seam is the substrate (AD-1); the adapter rule decides which seams stay thin (AD-2) and is applied three times (AD-3 to AD-5); AD-3's localized cue forces an i18n placement (AD-6); the toolkit's literal font references force the font pipeline (AD-7); resolution must work under Jest and Stryker before any of it is testable (AD-8); AD-9 to AD-12 close the red or blind gates; AD-13 restores the design surface.

### AD-1: The import seam is a same-path re-export from `src/components/ui-*/index`

**Context.** 93 import statements name one of the nine primitives, 79 outside the test trees, and the two heaviest consumers are deep-path rather than barrel — `@/components/ui-breakpoints` (28) and `@/components/ui-color-theme` (22) — so a barrel-only seam would not hold.

**Decision.** `ui-color-theme`, `ui-breakpoints`, `ui-typography`, `ui-checkbox`, `ui-toolbar` and `ui-tooltip` keep their module path and `export default`, and their body becomes a single re-export of the toolkit symbol (`UiColorTheme`/`UiBreakpoints` are the aliased `websiteColorTheme`/`websiteBreakpointsTheme`). Their local `theme.ts`, `styles.ts`, `types.ts` and `tooltip-wrapper.tsx` are deleted; nothing outside `src/components/ui-*/index.*` and `types.ts` changes for the seam itself.

**Rationale.** The seam is the unit of revert, review and documentation — a reader opening `ui-checkbox/index.tsx` learns in ten seconds that the fix belongs upstream. The toolkit is multi-tenant by design (`websiteColorTheme` and `crmColorTheme` over a shared `sharedPalette`), so the website's tokens arrive as a first-class export rather than as a fork.

**Alternatives rejected.** Rewriting the 93 call sites to import the package directly dissolves `src/components` as the design-system boundary and turns a revert into a 93-file diff. A `src/lib/ui-toolkit/` package adds a hop and a `no-orphans` surface for identical behaviour. Keeping `ui-breakpoints`/`ui-color-theme` local because they are cheap is rejected by FR5/FR6: they are value-identical (`UiBreakpoints` byte-identical, `UiColorTheme` identical but for `success`, never referenced here), so keeping them preserves the two-copies problem #458 exists to end; their identity is pinned by a contract spec instead.

**Trace.** FR5, FR6, FR7, FR8; NFR14; AC1.

### AD-2: A seam becomes an adapter only when a committed assertion fails without it

**Context.** "Which primitives keep local code?" is the question most likely to be answered by taste, and taste produced the two divergent copies. The PRD caps the set at three — `ui-link`, `ui-input`, `ui-button` — and calls a fourth a scope change. `ui-text-field-form` is a local composite over those seams, not an adapter over a toolkit component, so it sits outside the count.

**Decision.** The rule is mechanical, not a list: **render the raw toolkit component in the seam and run the existing suites; if a committed accessibility or security assertion goes red, that seam becomes an adapter and the failing spec is named in its doc comment as the justification. Otherwise it is a re-export.** Three corollaries bind: an adapter may only *preserve* behaviour, never add it; every adapter cites the upstream gap keeping it alive and the condition that retires it; and losing a *convention* is not grounds for one — `UiTypography` widens from a closed `component` union and an ARIA allow-list to `ElementType` + `...rest`, the ARIA props still reach the element, no assertion fails, so no adapter.

**Rationale.** It turns a judgement call into a reproducible experiment over evidence already committed, and it predicts the answer for the next primitive anyone considers swapping.

**Alternatives rejected.** An enumerated keep-local list (what #458's body carries) is correct today and unfalsifiable tomorrow, because nothing re-derives it when the toolkit moves. Adapters everywhere "for symmetry" is nine copies with extra steps.

**Trace.** FR9, FR27; AC2.

### AD-3: `ui-link` adapter - case-folded `rel` hardening and a localized new-tab cue

**Context.** The toolkit hardens `rel` on `n === "_blank"`, a strict comparison against a keyword the HTML specification matches ASCII-case-insensitively, so `_BLANK` opens a real new tab carrying no `rel` — the reverse-tabnabbing case `UiLink.test.tsx` already regression-tests (#382 F2). The same comparison gates the visually-hidden `newTabLabel`, which defaults to English `(opens in new tab)` on a bilingual site.

**Decision.** The seam keeps `resolveExternalLinkRel` from `src/shared/externalLinkRel.ts` — the one shared external-link sink, which case-folds `target` and merges caller `rel` tokens rather than replacing them — and resolves the cue as `newTabLabel ?? (opensNewTab ? t('accessibility.opens_in_new_tab') : '')` over the same case-folded comparison. `target` and `rel` are handed over by conditional spread, because the toolkit declares them `x?: T` without `| undefined` and `exactOptionalPropertyTypes` rejects an explicit `undefined`.

**Rationale.** Behaviour preservation is per-attribute: `rel` is a security property and must not depend on the toolkit's comparison; the cue is a naming property and must not depend on its English default. The **documented limitation** is load-bearing and asserted rather than implicit — for a `_BLANK` target the adapter restores the hardened `rel` but cannot restore the cue, because the toolkit's own render gate is the strict comparison, so `ui-toolkit-adapters.integration.test.tsx` asserts that link's name is the bare label. It retires when upstream gap 1 is fixed.

**Alternatives rejected.** Suppressing the cue entirely drops the announcement for every `_blank` link whose caller forgot one — a regression against a component meant to make the caller's memory irrelevant. Forking `UiLink` reinstates the second copy. `patch-package` is un-reviewable, invisible to AD-9's digest, and diverges from the published artifact the pin names.

**Trace.** FR12, FR14; NFR11, NFR16; AC2, AC6, AC8.

### AD-4: `ui-input` adapter - ARIA through `slotProps.htmlInput`, prop surface stays an allow-list

**Context.** MUI puts top-level `aria-*` props on the wrapping FormControl, where assistive tech never reads them; `buildInputSlotProps` places `aria-describedby`/`aria-required` on `slotProps.htmlInput` so they land on the `<input>` (#382 F3), and `AuthForm` wires `password-requirements` through that path and asserts it. The toolkit has no `describedBy`, and its `required` would reach the DOM as the native attribute.

**Decision.** The seam keeps `buildInputSlotProps` and owns `slotProps` outright — the toolkit forwards `slotProps` to its TextField unmodified, so this is a supported seam, not a workaround — and `UiInputProps` stays an **explicit allow-list derived from** the toolkit type:

```text
type ToolkitInputProps = ComponentProps<typeof ToolkitUiInput>;

export type UiInputProps = Pick<
  ToolkitInputProps,
  'sx' | 'placeholder' | 'value' | 'onChange' | 'onBlur' | 'onInput' |
  'error' | 'type' | 'fullWidth' | 'disabled' | 'id' | 'name' | 'autoComplete'
> & { describedBy?: string; required?: boolean };
```

**Rationale.** `Pick` keeps the toolkit as the single type source — the correct workaround for upstream gap 2, since the six consumed `Ui*Props` interfaces are declared but not exported — while keeping the surface narrow, and the documented `name`/`autoComplete` rationale stays on the type. The narrowness is not style: it is the artefact that keeps `required` off the DOM. The `Omit<ComponentProps<typeof UiInput>, 'ref' | 'slotProps' | 'required'>` PR #459 ships admits the whole of `TextFieldProps`, so the next caller can reintroduce the native attribute through a prop nobody reviewed.

**Alternatives rejected.** Hand-writing the interface again from `TextFieldProps` re-forks the type. Pushing `describedBy` upstream first is the adapter's exit criterion but makes this change wait on the toolkit's release cycle, which the PRD rules out.

**Trace.** FR10, FR11; NFR12; AC2, AC6.

### AD-5: `ui-button` adapter - falsy-`href` drop and `rel`/`target` prop declarations

**Context.** MUI renders an `<a>` as soon as `href` is present, so an empty `href` yields a destination-less anchor where the caller asked for a `<button>`; the local component dropped a falsy `href`. Separately the toolkit forwards `rel`/`target` at runtime but omits them from its prop type, so a call site passing them fails `tsc`.

**Decision.** The seam destructures `rel`, `target` and `href`, rebuilds them by conditional spread (same `exactOptionalPropertyTypes` reason as AD-3), and forwards the rest untouched. `UiButtonProps` is `ComponentProps<typeof ToolkitUiButton> & { rel?: string; target?: string; href?: string }`.

**Rationale.** Both halves are contract restoration, not new behaviour: one restores MUI's `href` contract as the component previously honoured it, the other restores a declaration for props the runtime already accepts. It retires when upstream gap 2 is fixed.

**Alternatives rejected.** `@ts-expect-error` at the call sites is banned by NFR17 and hides a genuine type gap. Declaration merging into the toolkit's module is global, invisible at the call site, and would silently stop applying once upstream exports the interface.

**Trace.** FR13; AC2.

### AD-6: The new-tab i18n key lives in a shared namespace, and the generator learns to see it

**Context.** AD-3 makes a *shared primitive* read a translation key. PR #459 puts `accessibility.opens_in_new_tab` in `src/features/landing/i18n/{en,uk}.json`; it works, and that is the trap. `scripts/localizationGenerator.js` merges every `src/features/*/i18n/*.json` into one flat `translation` namespace in the gitignored `pages/i18n/localization.json`, so a landing key is visible on `/swagger` too, and `no-shared-layers-to-features` cannot catch it — the coupling runs through i18next's resource merge, not an import.

**Decision.** Add `src/shared/i18n/{en,uk}.json` holding the `accessibility.*` namespace and extend `LocalizationGenerator` to merge an ordered list of roots — features first, `src/shared/i18n` **last** — so a shared key can never be shadowed by a colliding feature key. `scripts/localizationGenerator.d.ts` and `src/test/unit/localization-generator.test.ts` move in the same change, the latter gaining a shadowing case.

**Rationale.** The generator is the only thing that decides what "a namespace" means here, so the placement decision belongs *in the generator*, not in a folder convention nothing enforces. Merging shared last makes the invariant a property of the tool rather than of reviewer vigilance, and each root's listing stays sorted, preserving the deterministic-merge discipline of #335.

**Alternatives rejected.** `src/features/shared/i18n/` passes `feature-allowed-folders` and `src-feature-name-kebab-case`, so no gate objects — which is exactly why it is worse: it declares "shared" a product feature and puts a primitive's string under `src/features`. Leaving the key in landing works and rots the first time landing is split or renamed. A dedicated i18next namespace would introduce a second namespace convention repo-wide for one key.

**Trace.** FR28; NFR16; AC6.

### AD-7: The font pipeline moves to real-named `@font-face` over the committed `.woff2`

**Context.** `build/index.mjs` names the families literally 58 times; `next/font/local` mints an opaque per-import family name (`__golos_58e94b`) those references can never resolve to. The same generated names are **hand-copied** into the swagger `_fonts.scss`, where nothing re-derives them, so `/swagger`'s entire typography rests on an unverified string.

**Decision.** Declare the nine faces in `styles/global.css` under their real names (`Inter` 400/500/700; `Golos Text` 400/500/600/700/800/900) against the **same** committed `.woff2` assets (472,032 B), each `font-display: swap`; declare two metric-adjusted fallback faces (`Inter Fallback`, `Golos Text Fallback`) over `local('Arial')`; delete `src/config/Fonts/inter.ts` and `golos.ts`; replace `<main className={golos.className}>` with `.app-typeface`; add `src/config/Fonts/families.ts` exporting `GOLOS_TEXT_FAMILY`; and rewrite `_fonts.scss` to `$golos: 'Golos Text', sans-serif` / `$inter: 'Inter', sans-serif`.

The fallback overrides are **derived data with a recorded recompute rule** (FR18), stated in the comment above them: `size-adjust` is the ratio of the fallback's to the real face's frequency-weighted average lowercase advance width, and the ascent/descent/line-gap overrides are the face's own metrics divided by `unitsPerEm` and then by that `size-adjust`, computed from the committed `-Regular.woff2` of each family using the metric source `next/font` uses. Replacing a family's regular face requires recomputation in the same commit.

**Rationale.** One loading mechanism, the same bytes, zero added payload, and family names a browser and a reviewer can both verify — while removing the stale-hash defect as a side effect. The edge is unaffected and must stay so: css-loader emits the `.woff2` under `out/_next/static/media/`, the destination `next/font` used, and `scripts/cloudfront_routing.js` already allows `_next` in `ALLOWED_DIRS` and `woff2` in `ALLOWED_EXTENSIONS`, so `verify-edge-allowlist.mjs` needs no widening.

**Alternatives rejected.** Importing `@vilnacrm/ui-toolkit/styles.css` ships nine `@font-face` rules over `.ttf` totalling 1,348,788 B (1.29 MiB) against desktop `totalBytes` ceilings of 1,550,000 (homepage) and 1,450,000 (swagger) — a breach of a raise-only floor for fonts already shipped. Tokenizing the toolkit's families is the right long-term fix (upstream gap 3) and cannot gate this change. Keeping `next/font` alongside a real-named declaration means two mechanisms, two downloads, and the stale `_fonts.scss` hash survives.

**Trace.** FR15, FR16, FR17, FR18, FR19; NFR9, NFR10; AC4.

### AD-8: The ESM-only package is mapped in both `jest.config.ts` and `jest.mutation.config.ts`

**Context.** The package's `exports` map declares `types` and `import` and **no `require` condition**, so Jest's CJS resolver fails at *resolution*, not at parse — the bare specifier cannot be found at all.

**Decision.** Both configs carry the identical `moduleNameMapper` pair pointing the bare specifier at `<rootDir>/node_modules/@vilnacrm/ui-toolkit/build/index.mjs` and the `styles.css` subpath at `build/index.css`, and both extend the ESM allow-list to `'/node_modules/(?!(uuid|@faker-js/faker|@vilnacrm/ui-toolkit)/)'` so babel-jest transforms the `.mjs`. A client-layer spec imports both configs and asserts the toolkit-related entries are equal, so FR23's "a divergence is a defect" is enforced rather than documented.

**Rationale.** `jest.mutation.config.ts` is what Stryker's in-process Jest runner loads, and Stryker runs with `enableFindRelatedTests`: when Jest cannot resolve a spec's imports it runs nothing, exits 0, and **every mutant reads as survived** — indistinguishable from genuinely weak tests, a trap this repository has already been caught by. No `ui-*` file is in the `curated` list or matches `config/mutation-policy.json`'s `mutableDirectories`, so the mapping is needed not for this change's files but so *other* mutants' related specs, which transitively import `@/components`, still load.

**Alternatives rejected.** Mapping only in `jest.config.ts` produces a silently wrong mutation score. Running Jest in ESM mode is a repo-wide runner change to serve one dependency. Vendoring a CJS build reintroduces a second copy of the artifact AD-9's digest exists to pin.

**Trace.** FR21, FR22, FR23; AC3.

### AD-9: A committed SHA-256 digest, verified offline, at the point where the tarball is fetched

**Context.** `bun.lock` records the remote tarball as the 2-element `[spec, {peerDependencies}]` form with **no `sha512`**, unlike every registry entry beside it. `Dockerfile:21` runs `bun install --frozen-lockfile` in the `base` stage, so every dev-image build and BuildKit cache miss refetches a GitHub release asset anyone with upstream push access can replace, and `config/osv-scanner.toml`'s differential scan cannot key a remote-tarball entry to an ecosystem/package/version triple, so the dependency sits outside SCA coverage entirely. The toolkit's `CONSUMING.md` claims the lockfile hash makes the pin tamper-evident; that is false for this dependency form and must not be repeated in this repository's documentation.

**Decision.** Apply the `contracts/user-service/checksums.json` + `make lint-contracts` precedent (#376) in the same offline/online split:

| Piece | Path | Role |
| --- | --- | --- |
| Version pin | `.env` / `.env.example` `UI_TOOLKIT_VERSION=v0.3.0` | The one authoritative tag |
| Digests | `config/ui-toolkit-checksums.json` | `algorithm`, `version`, `tarballUrl`, per-artifact SHA-256 |
| Verifier | `scripts/verifyUiToolkit.mjs` | Offline: hashes the installed `build/*`, asserts the pin |
| Gate | `make lint-ui-toolkit` | Hermetic; joins `make lint` and `CI_LINT_TARGETS` |
| Refresher | `make update-ui-toolkit` | Maintainer-only, network, rewrites the digests |

The verifier hashes the installed `node_modules/@vilnacrm/ui-toolkit/build/{index.mjs,index.css,index.d.ts}` plus the package `version`, compares each against the committed digest, and asserts that `package.json`'s dependency URL and `bun.lock`'s spec both name exactly `${UI_TOOLKIT_VERSION}`. Reading only committed files plus `node_modules`, with no network, host binary or Docker, it belongs **inside** `make lint` — the same reasoning that puts `lint-api-versions` there and keeps `lint-contracts` out. It is a container gate like every other npm-tool gate (#399), with the recipe form `$(DEV_READY) $(PM_EXEC) node scripts/verifyUiToolkit.mjs` — `lint-api-versions`' recipe line for line. Its precondition is nonetheless stronger than that gate's (committed files only) and than `lint-pins`' (deliberately dependency-free, because `make lint` reaches that one on the host): it needs an installed `node_modules/@vilnacrm/ui-toolkit`. An absent or partial installed tree is therefore a **hard failure naming the missing artifact**, never a skip — the same fail-closed rule as "a missing digest file fails rather than passing vacuously", because a supply-chain check that quietly passes when it cannot look is worse than no check at all. Verification also runs **where the fetch happens**: the `base` stage already copies `package.json bun.lock checkNodeVersion.js scripts/*.mjs` into `/app`, so a top-level `scripts/verifyUiToolkit.mjs` rides that COPY glob (flattened to `/app/verifyUiToolkit.mjs`), and one added `COPY config/ui-toolkit-checksums.json ./config/` plus `bun install --frozen-lockfile && node verifyUiToolkit.mjs` makes a substituted release asset fail the image build rather than ship in it. The script takes `--checksums=` defaulting to `config/ui-toolkit-checksums.json`, so one invocation form works in the container and on the host. `config/` beats a new `contracts/ui-toolkit/` tree because CODEOWNERS already owns `/config/` as a directory, on the stated grounds that quietly editing a gate input is how a red check turns green. Coverage follows the repository convention: rows for both targets in `tests/bats/make-target-coverage.tsv` with `bats` evidence in `tests/bats/makefile_targets.bats` (`bats` there means a dedicated Bats test exists), plus a unit spec mirroring `src/test/unit/contracts/check-api-versions.test.ts` — a mismatched digest fails, a missing digest file fails rather than passing vacuously, an unsupported `algorithm` fails, and a pin disagreement between `.env`, `package.json` and `bun.lock` fails. That spec is `src/test/unit/contracts/verify-ui-toolkit.test.ts`, its layer is the **client** layer, and the verifier's coverage is held there by a per-file 100% threshold group — see the Test Strategy below. It is never added to the edge layer's file list, whose scope is the shipped runtime scripts.

**Rationale.** The digest is not defence in depth; it is the *only* integrity signal this dependency has (NFR13). Hashing the installed artifacts rather than the tarball is what makes the blocking check offline: bun never hands a consumer the `.tgz`, but every environment has the installed tree, and a re-cut release asset changes those bytes. The tarball digest is still recorded and is what `make update-ui-toolkit` verifies over the network when the pin moves.

**Alternatives rejected.** Trusting `bun.lock` — there is nothing to trust. A network-only check cannot live in `make lint`, would make the static lane flaky, and still would not prove what bun installed. Vendoring the tarball puts a 3 MB blob in git. A `config/osv-scanner.toml` entry is impossible: there is no package coordinate to key an advisory to.

**Trace.** FR1, FR2, FR3, FR4; NFR13; AC1, AC6.

### AD-10: The static-JS budget is closed by a directed trim, with a named not-shippable outcome

**Context.** `scripts/ci/validate-build-artifact.sh` sums every `.js` file under `out/_next/static` and fails over `js_budget=3300000`; measured 3,336,275 B, i.e. 36,275 B / 1.10% over. The script's comment reads "never raise it to absorb a regression — trim the imports instead", and `.claude/react-sdlc.yml` `quality.*` are raise-only.

**Decision.** Four steps, in order, with the analyzer as the first artifact (FR32).

1. **Measure both sides identically.** `make build-analyze` on `origin/main` and on the branch, keep both reports, and reproduce the gate's own arithmetic per file (`find out/_next/static -type f -name '*.js' -printf '%s\n'`) so the delta is attributable to named chunks rather than to a total.
2. **Rule the PRD's first suspect in or out.** It is already measurably out: after the change no `src/components/ui-*/index.*` imports `@mui/material` at all. Two hypotheses remain.
3. **Hypothesis A - duplication.** The gate sums *every* file, so a 275.7 KB module emitted into more than one page chunk counts more than once. If the analyzer shows `@vilnacrm/ui-toolkit` inside two or more page chunks, the fix is a `splitChunks` cache group in `next.config.js` hoisting it into one shared chunk — a bundler configuration change, not a budget change.
4. **Hypothesis B - failed tree-shaking.** `build/index.mjs` is one module whose components share theme objects, and `sideEffects: ["**/*.css"]` marks only the CSS. Confirm by searching the emitted chunk for a symbol this site never renders (`UiPinInput`, `UiTaskCard`). The seams already use named imports, so no lever remains inside this repository and the outcome escalates.

**Fallback (FR33), stated explicitly.** If neither step closes 36,275 B, **the change is not shippable in this form** and waits for the toolkit to publish per-component entry points (`@vilnacrm/ui-toolkit/ui-button`) the seams import instead. Not available under any reading: raising `js_budget`, excluding a chunk from the sum, splitting a chunk into several (the sum is over all files, so it is a no-op), or shipping 1.10% over.

That branch's consequences are stated rather than left implicit, because a fallback whose downstream work simply stops is how a branch is abandoned instead of parked. Three things follow. The per-component entry-point request is filed as **upstream gap 7** under FR37 in the same change, so the prerequisite this fallback depends on has an owner instead of being a hope. AD-11's baseline work is **suspended, not skipped**: it is measured over the tree the byte fix produces, so with no byte fix there is no tree to isolate against — no PNG is regenerated and `make test-visual-update` does not run. And the upstream-gap filing and documentation sync still complete, with PR #459 converted to **draft** rather than merged or closed, so the seam, digest and font work is re-entered when an upstream release carrying per-component entry points lands.

**Trace.** FR31, FR32, FR33; NFR8, NFR17; AC6.

### AD-11: Visual baselines are separated by a multi-build experiment before any PNG is regenerated

**Context.** 132 of 156 visual tests fail. `playwright.config.ts` sets no `maxDiffPixels` and no `threshold`, so any differing pixel fails by design, and CODEOWNERS gates both `/src/test/visual/*-snapshots/` and `/src/test/visual/**/*-snapshots/` to `@Kravalg` because an approved wrong baseline certifies itself (#344). `uk_largeMobile` changed height by 21 px — a metric change, not anti-aliasing — and the two mechanisms that produce it demand opposite responses.

**Decision.** Three builds, one variable at a time, before `make test-visual-update` runs at all.

- **Build M - `origin/main`.** Confirms the committed baselines still reproduce, excluding a machine or browser difference before anything is attributed to this change.
- **Build A - branch HEAD with `_fonts.scss` reverted to the generated names.** `next/font` is gone on the branch, so those names resolve to nothing and `/swagger` renders in the browser fallback. If Build A's swagger screenshots **match the committed baselines**, `main` was also rendering `/swagger` in a fallback — the hardcoded hashes were stale — and the branch's swagger movement is an intended fix the new baselines should record. If they **differ**, the hashes were live on `main`, the branch changed real rendering, and that must be explained before it is accepted.
- **Build B - branch HEAD as-is.** The landing set is judged here: recompute the four override values per AD-7's rule from the committed `-Regular.woff2`. If the recomputed values differ from the committed ones the metrics are **wrong and are fixed**, never baselined. If they reproduce and the landing set still moves, the movement is the real face against `next/font`'s generated fallback and is baselineable with that cause recorded.

Every regenerated PNG carries a written cause in the change record — "swagger now renders real Golos Text (stale hash on `main`)", "fallback metrics recomputed", or "real-face metrics differ from the generated fallback" — plus the build that proved it, reviewed by the CODEOWNERS owner. Because `NEXT_PUBLIC_MAIN_LANGUAGE=uk`, only the `uk` lane runs: the `en` baselines did not execute, did not move, and must not be regenerated.

**Rationale.** Each build moves exactly one variable, so the experiment is decisive rather than suggestive, and the two causes it separates call for opposite actions — record a fix, or fix a bug.

**Alternatives rejected.** `make test-visual-update` then approve turns a possible layout regression into a certified baseline. Adding `maxDiffPixels`/`threshold` is banned by NFR17 and blinds the gate to the next real regression. Deleting the moving snapshots is the same thing, less honestly.

**Trace.** FR18, FR34, FR35, FR36; NFR17; AC7.

### AD-12: The `UiCheckBox` hover-token assertion reads the CSSOM and stays in the client layer

**Context.** `UiCheckBox.test.tsx` "keeps the hover border token on the styled box" is the one failing Jest case (1 of 1003). The selector logic is sound — the toolkit does emit `&:hover:not(.Mui-disabled) .ui-checkbox-box { border-color: #1eaeff }` — so the failure is that the text it reads is empty.

**Root cause.** Emotion's cache enables *speedy* insertion — `CSSStyleSheet.insertRule()` — when `process.env.NODE_ENV === 'production'`, and in that mode the `<style>` element has no child text node, so `style.textContent` is `''`. `make` exports `.env.production`, so a containerised `make test-unit-client` and a bare host `jest` disagree on exactly this assertion. A latent second defect compounds it: `.split('}')` mis-splits any rule nested in an at-rule, so even in non-speedy mode the matched chunk can be a fragment.

**Decision.** Read the CSSOM, which is populated under both insertion modes:

```text
const rules = Array.from(document.styleSheets)
  .flatMap(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText));
```

then assert some rule's text carries `:hover`, `.ui-checkbox-box` and the border-color token. The assertion **stays in the client jsdom layer**, in `src/test/testing-library/UiCheckBox.test.tsx`.

**Rationale.** It is a per-component token contract and the direct replacement for the pre-swap assertion that read the local `styles.ts` object; jsdom's CSSOM can see the rule even though jsdom never *applies* `:hover`, so the layer that owned the token before still owns it.

**Alternatives rejected.** Deleting the assertion is forbidden by FR27 — it is the token regression guard crossing exactly the rendering-path change this PR asks a reviewer to accept. Conditionals and skips are banned outright. Asserting against the toolkit's exported style object asserts the dependency, not the app. Forcing `NODE_ENV !== 'production'` changes Emotion's insertion mode for every client spec to fix one assertion. Moving it to Playwright would add a 235th baseline to the very set this change already asks a CODEOWNER to review.

**Trace.** FR24, FR27; NFR17; AC5, AC6.

### AD-13: Storybook is rewritten against the seams and renders production's stylesheet

**Context.** Six of twelve story files were deleted (`button`, `checkbox`, `link`, `toolbar`, `tooltip`, `typography`). No gate requires a story to exist — `scripts/ci/mutation-scope.ts` only *excludes* `*.stories.tsx` — so deletion passes CI silently while halving the reviewable design surface, while `.storybook/preview.ts` imports no stylesheet and `.storybook/main.ts` still copies nine `.woff2` into `staticDirs` for a mechanism that no longer exists.

**Decision and rationale.** Rewrite the six stories against the toolkit-backed seams (importing `@/components`, not the toolkit, so they exercise what ships), import `../styles/global.css` from `.storybook/preview.ts`, and delete the dead `staticDirs` block. Without the stylesheet, `storybook build` ships a design surface rendering every toolkit component in a fallback face — the drift #458 exists to stop, in the one place a designer looks.

**Alternatives rejected.** Leaving the stories deleted is invisible to CI and halves the design-review surface; keeping `staticDirs` leaves config that serves a mechanism nothing uses.

**Trace.** FR20, FR30; AC4, AC6.

## Component & File Map

| File | Role after the change | FRs |
| --- | --- | --- |
| `src/components/ui-color-theme/index.ts` | Seam: re-export `UiColorTheme` (toolkit `websiteColorTheme`) | FR5, FR6 |
| `src/components/ui-breakpoints/index.ts` | Seam: re-export `UiBreakpoints` (byte-identical values) | FR5, FR6 |
| `src/components/ui-typography/index.tsx` | Seam: re-export; ARIA flows via `...rest` | FR5 |
| `src/components/ui-checkbox/index.tsx` | Seam: re-export; MUI control + `span.ui-checkbox-box`, gains `aria-invalid` | FR8 |
| `src/components/ui-toolbar/index.tsx` | Seam: re-export | FR5 |
| `src/components/ui-tooltip/index.tsx` | Seam: re-export; gains Enter/Space/Escape, `role="button"`, `aria-expanded`, `aria-controls` | FR7 |
| `ui-typography/{theme,types}.ts`, `ui-checkbox/{styles,types}.ts`, `ui-toolbar/theme.ts`, `ui-tooltip/{theme.ts,tooltip-wrapper.tsx}` | Deleted with the local implementations | FR5, FR7, FR8 |
| `src/components/ui-button/index.tsx` + `types.ts` | Adapter: falsy-`href` drop; `ComponentProps<…> & { rel?, target?, href? }` | FR13 |
| `src/components/ui-link/index.tsx` + `types.ts` | Adapter: `resolveExternalLinkRel`, localized `newTabLabel` | FR12, FR14 |
| `src/components/ui-input/index.tsx` + `types.ts` | Adapter: `buildInputSlotProps` owns `slotProps`; explicit `Pick` allow-list | FR10, FR11 |
| `src/components/ui-text-field-form/**`, `src/components/ui-image/**` | Untouched; the first now composes the toolkit-backed seams | out of scope |
| `src/components/index.ts` | Unchanged (11 lines, byte-identical) | FR5 |
| `src/shared/externalLinkRel.ts` | Unchanged; still the single `rel` sink | FR12 |
| `src/shared/i18n/{en,uk}.json` | New: the shared `accessibility.*` namespace | FR28 |
| `scripts/localizationGenerator.js` + `.d.ts` | Merge ordered roots, shared last | FR28 |
| `styles/global.css` | 9 real-named `@font-face` + 2 fallback faces + `.app-typeface` | FR15, FR18 |
| `src/config/Fonts/families.ts` | New: `GOLOS_TEXT_FAMILY` for the app's own styled nodes | FR15 |
| `src/config/Fonts/{inter,golos}.ts` | Deleted with `next/font/local` | FR16 |
| `pages/_app.tsx` | `<main className="app-typeface">` replaces the generated class | FR16 |
| `src/features/swagger/.../variables/fonts/_fonts.scss` | Real family names replace the generated hashes | FR19 |
| `src/features/landing/components/**/styles*.ts` | Consume `GOLOS_TEXT_FAMILY` | FR15 |
| `.storybook/preview.ts`, `.storybook/main.ts` | Import `styles/global.css`; drop dead `staticDirs`; six stories rewritten | FR20, FR30 |
| `jest.config.ts`, `jest.mutation.config.ts` | Identical toolkit mapping + ESM allow-list entry; `jest.config.ts` additionally carries the path-keyed 100% coverage group for `scripts/verifyUiToolkit.mjs` | FR21, FR22, FR23, FR26 |
| `package.json`, `bun.lock` | The pinned release-tarball dependency | FR1 |
| `.env`, `.env.example` | `UI_TOOLKIT_VERSION` | FR2 |
| `config/ui-toolkit-checksums.json` | Committed SHA-256 digests (CODEOWNERS-owned) | FR3 |
| `scripts/verifyUiToolkit.mjs` | Offline verifier: digests + pin agreement | FR3, FR4 |
| `Makefile`, `Dockerfile` | `lint-ui-toolkit` / `update-ui-toolkit`; COPY the digests and verify after install | FR3, FR4 |
| `tests/bats/make-target-coverage.tsv` | Rows for both new targets | FR3 |
| `src/test/a11y/interaction-states.ts`, `src/test/e2e/tooltip.spec.ts` | Register and drive the tooltip's keyboard states | NFR7 |
| `src/test/e2e/register-form/constants.ts`, `src/test/testing-library/AuthFormPolicyLinks.test.tsx` | Locators repaired for the new-tab cue | FR29 |
| `tests/integration/coverage/misc-small/ui-toolkit-adapters.integration.test.tsx` | Drives every adapter branch at 100% | FR25 |
| `src/test/visual/**/*-snapshots/` | Regenerated only per AD-11, one recorded cause per PNG | FR34, FR36 |
| `src/test/unit/contracts/verify-ui-toolkit.test.ts` | New: the verifier's client-layer spec and its coverage home | FR3, FR4, FR26 |
| GitHub issues on `VilnaCRM-Org/ui-toolkit` (no file in this repository) | The seven upstream gap filings — **no design needed**, see "Adapter deprecation" | FR37 |

## Data and Style Flow

### Render path: a call site through the seam to the toolkit

```text
src/features/landing/components/**/*.tsx        pages/swagger.tsx
        |  import { UiLink, UiCheckbox } from '@/components'
        |  import UiBreakpoints from '@/components/ui-breakpoints'   (28 deep imports)
        v
src/components/index.ts  (barrel, unchanged)
        v
src/components/ui-<name>/index.{ts,tsx}   <-- THE SEAM (the only file that changed)
        |
        +-- re-export ..... ui-color-theme, ui-breakpoints, ui-typography,
        |                   ui-checkbox, ui-toolbar, ui-tooltip
        |
        +-- adapter ....... ui-link   -> resolveExternalLinkRel(target, rel)   [#382 F2]
        |                              -> t('accessibility.opens_in_new_tab')  [FR14]
        |                   ui-input  -> buildInputSlotProps(describedBy, required)
        |                              -> slotProps.htmlInput                  [#382 F3]
        |                   ui-button -> falsy-href drop + rel/target prop types
        v
@vilnacrm/ui-toolkit  (build/index.mjs, ESM only, no `require` condition)
        v
MUI 9 + Emotion  ->  DOM
        +-- <input aria-describedby="password-requirements" aria-required="true">
        +-- <a rel="noopener noreferrer"> + visually-hidden localized cue
        +-- <span class="ui-checkbox-box"> carrying the border tokens

Jest and Stryker take the same path, the bare specifier rewritten by moduleNameMapper
to build/index.mjs and transformed by babel-jest (AD-8).
```

### Font resolution: one `.woff2` set, two consumers

```text
src/assets/fonts/Inter/*.woff2  (3 faces, 316,144 B)
src/assets/fonts/Golos/*.woff2  (6 faces, 155,888 B)     total 472,032 B, unchanged
        v
styles/global.css
   @font-face { font-family:'Inter';      src:url('../src/assets/fonts/Inter/...') swap }  x3
   @font-face { font-family:'Golos Text'; src:url('../src/assets/fonts/Golos/...') swap }  x6
   @font-face { font-family:'Inter Fallback';      src:local('Arial'); size-adjust/... }
   @font-face { font-family:'Golos Text Fallback'; src:local('Arial'); size-adjust/... }
   .app-typeface { font-family:'Golos Text','Golos Text Fallback',sans-serif }
        |        (css-loader emits the faces to out/_next/static/media/, already covered by
        |         ALLOWED_DIRS `_next` + ALLOWED_EXTENSIONS `woff2` — no allow-list widening)
        +-----------------------------+------------------------------+
        v                             v                              v
pages/_app.tsx                @vilnacrm/ui-toolkit         src/features/swagger/.../_fonts.scss
<main class="app-typeface">   themes name the families      $golos: 'Golos Text', sans-serif
                              literally: "Inter" x36,       $inter: 'Inter', sans-serif
src/config/Fonts/families.ts  "Golos Text" x22 -> now                |
GOLOS_TEXT_FAMILY  ---------> resolvable                             v
        |                                                    _ui-typography.scss, styles.scss
        v                                                    (the whole /swagger typography)
landing styles.ts / styles.success.ts

.storybook/preview.ts imports styles/global.css, so Storybook resolves the same faces.
```

## Test Strategy per Layer

| Layer | Target | What it proves here | Specs added or changed |
| --- | --- | --- | --- |
| client (jsdom) | `make test-unit-client` | Seam behaviour, tokens, ARIA, theme identity, config parity, **and the digest verifier's own branches** | `UiCheckBox`, `UiLink`, `UiButton`, `UiTooltip`, `UiTooltipWrapper`, `AuthFormPolicyLinks`; new theme-contract, jest-config-parity and `verify-ui-toolkit` specs |
| server (node) | `make test-unit-server` | Untouched — no Apollo surface changes | none |
| integration | `make test-integration` | Every adapter branch, at 100% | `ui-toolkit-adapters.integration.test.tsx` (10 cases), `tooltip-wrapper.integration.test.tsx` |
| edge | `make test-unit-edge` | The edge allow-list still covers the export unchanged | none |
| contract | `make test-contract` | Unaffected — no API surface changes | none |
| e2e | `make test-e2e` | Tooltip keyboard operation, cue-aware locators, register flow | `tooltip.spec.ts`, `register-form/constants.ts` |
| a11y | `make test-a11y` | Routes and interaction states at WCAG 2.1 AA | `src/test/a11y/interaction-states.ts` + the journey that scans them |
| visual | `make test-visual` | Font rendering and the checkbox rendering path | baselines regenerated only per AD-11 |
| mutation | `make test-mutation-changed` | That resolution works, not that `ui-*` is mutated | none — no `ui-*` file is in scope |

**Client (jsdom).** Three assertion families survive unweakened: the checkbox border tokens (default, error, hover — the last via AD-12's CSSOM read), `UiLink`'s six cases including "hardens a case-variant blank target", and `UiInput`/`UiTextFieldForm`'s `aria-describedby` delivery; `expectNoA11yViolations` stays on the checkbox. Two specs are **added for the seams**: a theme-contract spec asserting `UiBreakpoints.breakpoints.values` is `{xs:375, sm:640, md:768, lg:1024, xl:1440}` and that every palette token this repository reads still holds its value — a re-export's value now arrives from a dependency, so it needs an assertion of its own — and AD-8's config-parity spec.

A **third** added spec, `src/test/unit/contracts/verify-ui-toolkit.test.ts`, is where AD-9's `scripts/verifyUiToolkit.mjs` is covered, and this layer is the only one that can hold it. It matches `UNIT_GLOB` (`src/test/unit/**/*.test.ts`), which the client layer's `testMatch` includes, and the client layer keeps Jest's **default** imported-file coverage scope — which is exactly how `src/test/unit/contracts/check-api-versions.test.ts` already puts the `scripts/`-rooted `scripts/contracts/check-api-versions.mjs` under coverage today. The client layer's own thresholds are **global** (92/95/97/97), so a global floor cannot fail on one uncovered module; `jest.config.ts` therefore gains a path-keyed group beside `CLIENT_COVERAGE_THRESHOLD`:

```text
'./scripts/verifyUiToolkit.mjs': { branches: 100, functions: 100, lines: 100, statements: 100 }
```

That group is falsifiable in **both** directions, which is the property a coverage criterion has to have: an uncovered branch fails the threshold, and a module the run never loaded — spec deleted, renamed, or its import dropped — fails with `Jest: Coverage data for ./scripts/verifyUiToolkit.mjs was not found.` The key is a plain relative path, not a `<rootDir>` token: Jest resolves a threshold-group key with `path.resolve()` against the working directory and does not interpolate `<rootDir>` there, so a `<rootDir>`-prefixed key would match nothing and, being unmatched, would fail loudly rather than silently — but the relative form is the one that works. Adding the group **raises** enforcement over the status quo; it lowers no existing floor (NFR17). *(FR3, FR4, FR8, FR10, FR12, FR23, FR26, FR27)*

**Integration (100%).** The adapter branches are the coverage-critical surface: for `UiLink` the lower-case `_blank`, case-variant `_BLANK`, caller-`rel`-merge, explicitly-empty-label, same-tab and caller-supplied-label paths; for `UiButton` the rel+target, neither, and empty-`href`-stays-a-button paths. `scripts/verifyUiToolkit.mjs` is **not** covered here and must not be claimed here: `INTEGRATION_COVERAGE_FROM` in `jest.config.ts` is `<rootDir>/src/**/*.{ts,tsx}` plus exclusions, so a `scripts/`-rooted module is never collected in this layer and this layer's 100% verdict is silent about it — an acceptance criterion resting on it could not fail. Its coverage home is the client layer, under the per-file group described above. *(FR24, FR25)*

**Edge.** No edge script changes; the proof is negative and runs in the build gate — the `.woff2` land under `out/_next/static/media/`, which `cloudfront_routing.js` already allows, so `verify-edge-allowlist.mjs` passes with no widening. Needing to widen it would mean the emission moved and is a defect, not a gate change. *(FR15, NFR17)*

**e2e and a11y.** The tooltip gains keyboard operation, so `interaction-states.ts` gains the states — trigger focused, expanded via Enter/Space, dismissed via Escape — and `src/test/e2e/tooltip.spec.ts` drives them and calls `scanInteractionState`. The registry's drift guard parses the specs with the TypeScript AST and only counts an executable call, so a registered-but-unscanned state fails; satisfy it by adding the scan, never by editing the guard. The localized cue changes **every** `_blank` link's accessible name, so the name-based locator sweep — `AuthFormPolicyLinks`, `register-form/constants.ts` and any a11y-route or interaction-state locator matching a link or label name — lands in the same change. *(FR7, FR14, FR29; NFR6, NFR7)*

**Visual and mutation.** Visual is an investigation step per AD-11, not a regeneration step, and only the `uk` lane runs. No `ui-*` file is in `stryker.config.mjs`'s curated list or matches `mutableDirectories`, so this change mutates nothing new and must not alter the scope to accommodate itself (NFR2). *(FR34, FR35, FR36)*

## Rollout and Rollback

**Rollout order.** One PR, with a natural internal order in which each step is independently green: (1) the pin, digest, gate and Dockerfile verification (AD-9) — nothing renders differently yet; (2) the Jest and Stryker mapping (AD-8) — nothing imports the package yet; (3) the six re-export seams and three adapters (AD-1 to AD-5) with their specs; (4) the shared i18n namespace and the generator change (AD-6); (5) the font pipeline and Storybook (AD-7, AD-13); (6) the byte-budget trim (AD-10) and the baseline investigation (AD-11), which can only be measured once (1)-(5) exist.

**Rollback.** The seam is what makes reverting cheap, by design rather than by accident. Reverting one primitive is a single-file change: restore that seam's previous body plus its deleted `theme.ts`/`styles.ts`/`types.ts` from history. No call site moves, the barrel does not change, and the type surface at the seam is the same either way. Reverting everything is `git revert` plus dropping the dependency, and the specs that prove the old behaviour are the same specs that prove the new one — none was rewritten to suit the toolkit.

Two pieces do **not** revert with a seam. `styles/global.css` and `_fonts.scss` are a matched pair (real names in both, or generated names in both), and `pages/_app.tsx`'s `.app-typeface` depends on the first; reverting the fonts while keeping the seams would leave every toolkit component in a fallback face — a silent visual regression, which is why it is called out rather than assumed.

**Adapter deprecation.** Each adapter names its upstream gap. Fixing gap 1 (case-sensitive `rel`) retires `ui-link`'s `resolveExternalLinkRel` call *and* restores the `_BLANK` cue; fixing gap 2 (unexported prop types) lets `ui-button`'s intersection and `ui-input`'s `Pick` derive from an exported interface; fixing gap 4 (English `newTabLabel`) leaves the localization in place but no longer as a suppression. In each case the retiring commit must keep the adapter's named regression test green — that test is the contract, not the adapter. Gap 7 (no per-component entry points) retires no adapter: it is the prerequisite AD-10's not-shippable branch waits on, and it is filed alongside the other six so that branch is not blocked on an unfiled request.

**Trace.** FR37; AC8. FR37 is a **process obligation** — seven upstream issue filings, with no artifact and no code in this repository — so it needs no design decision of its own and has none; this subsection is its whole architecture, and it is discharged by the epics' Story 9.2. Recording that explicitly is the point: an FR that reaches no decision is otherwise indistinguishable from an FR the architecture forgot.

## Risks and Mitigations

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | The 36,275 B gap is not closable by trimming | AD-10's directed procedure; FR33 makes "not shippable in this form" the outcome, never a budget move |
| R2 | 132 red screenshots make a blind `test-visual-update` look like the fix | AD-11's three-build isolation, one recorded cause per PNG, CODEOWNERS review |
| R3 | The failing hover assertion gets weakened rather than fixed | AD-12 names the speedy-insertion root cause and the CSSOM read; deletion, skipping and conditionals are forbidden by FR27 |
| R4 | Accessible names change site-wide and break locators far from the diff | FR29's same-change sweep; the a11y route and interaction-state registries carry drift guards that fail on an omission |
| R5 | `UiInputProps` widens to all of `TextFieldProps`, letting `required` reach the DOM | AD-4 keeps the explicit `Pick`; the `UiTypography` widening is accepted because no assertion fails |
| R6 | The dependency is outside SCA coverage — osv-scanner cannot key a tarball entry | Accepted and named: AD-9's digest plus the single pin make a *substitution* detectable; an unsurfaced upstream advisory is residual risk |
| R7 | The fallback metric overrides rot into magic numbers | AD-7 records the recompute rule beside the values; it is a documented procedure, not a gate, and is this design's weakest verification link |
| R8 | Storybook drifts silently from production typography | AD-13: `preview.ts` imports the production stylesheet and the six stories are rewritten |
| R9 | The generator change alters the merged bundle beyond the new namespace | AD-6 keeps every listing sorted; the generator spec gains a shadowing case; `pages/i18n/localization.json` stays gitignored and regenerated by the existing hooks |
| R10 | A future contributor adds a fourth adapter by taste | AD-2 is a rule with an experiment behind it; FR9 makes a fourth adapter a scope change |

## Open Questions

Every question this architecture raised is closed below. None is left for implementation to decide.

> Assumption: `package.json` cannot interpolate `${UI_TOOLKIT_VERSION}`, so FR2's single source of
> truth is realised in the `.nvmrc` shape — one authoritative value plus a gate holding every literal
> restatement to it — exactly as `engines.node` restates `.nvmrc` under `check-version-pins.mjs`. It
> satisfies FR2's actual invariants (one authoritative pin, no rival variable, no unverified literal),
> and `UI_TOOLKIT_VERSION` sits outside `check-api-versions.mjs`'s rival-pin sweep
> (`(^|_)(?:USER_SERVICE|GRAPHQL_SCHEMA|GRAPHQL_SPEC)[A-Z0-9_]*VERSION$`), so it cannot collide with
> the user-service invariant.

> Assumption: the blocking digest check hashes the **installed** `build/*` artifacts, not the `.tgz`,
> because bun never hands a consumer the tarball and the check must be hermetic to live in
> `make lint`. The tarball's own SHA-256 is still recorded and is verified over the network by
> `make update-ui-toolkit` when the pin moves — the same offline/online split `lint-contracts` uses.

> Assumption: the digests live in `config/ui-toolkit-checksums.json` rather than under
> `contracts/ui-toolkit/`. `contracts/` is the vendored-upstream-contract tree and this is a gate
> input; CODEOWNERS already owns `/config/` as a directory precisely because quietly editing a gate
> input is how a red check turns green.

> Assumption: the shared i18n namespace is `src/shared/i18n/` and `LocalizationGenerator` merges it
> last. A folder convention alone would be unenforced, and `src/features/shared/i18n/` would pass every
> gate while declaring "shared" a product feature.

> Assumption: the hover-token assertion stays in the client jsdom layer over the CSSOM. jsdom never
> applies `:hover`, so the applied appearance is unprovable there — but the emitted rule is the
> observable both implementations share and is what the deleted `styles.ts` assertion actually proved.
> A hovered-state Playwright snapshot is deliberately not added: it would put a 235th baseline in
> front of the CODEOWNER already being asked to review 132 of them.

> Assumption: `ui-breakpoints` and `ui-color-theme` are re-exports, not kept local, even though
> keeping them local would be the single most effective way to stop 50 deep-import chunks pulling the
> toolkit graph. FR5/FR6 require the swap and the byte problem is addressed at its own layer in AD-10;
> solving a bundling problem by preserving a duplicate implementation would restore the drift #458
> exists to end. Their values are pinned by an added contract spec instead.

> Assumption: the PRD's named first suspect for the byte overage — a surviving `@mui/material` barrel
> import in a seam — is already ruled out by measurement: after the change no
> `src/components/ui-*/index.*` imports `@mui/material`. AD-10 therefore starts from chunk duplication
> and failed tree-shaking rather than re-checking a cleared hypothesis.

> Assumption: `UiImage` and `UiTextFieldForm` stay local and untouched — the first depends on
> `next-export-optimize-images`, which the toolkit cannot provide; the second is strictly richer here
> and merely re-composes the toolkit-backed seams. `UiInput` is the ninth changed module, correcting
> the PR narrative.

> Assumption: the recompute rule for the fallback metric overrides is a documented procedure recorded
> beside the values, not a new automated gate. Adding a metrics-extraction dependency to mechanise it
> is real work with its own supply-chain surface and is out of scope; R7 records this as the design's
> weakest verification link rather than pretending otherwise.

> Assumption: this architecture targets toolkit `v0.3.0` as published and does not wait for an
> upstream release, except in the one case FR33 already names — if AD-10 cannot close the byte gap,
> per-component entry points become a prerequisite and the change waits.

> Assumption: `scripts/verifyUiToolkit.mjs` is covered in the **client** layer under a per-file 100%
> `coverageThreshold` group, and in no other layer. The integration layer structurally cannot collect it
> (`INTEGRATION_COVERAGE_FROM` is `src/**`), the edge layer's 100%-per-file list is reserved for code that
> actually ships to production, and the client layer's global floors would pass with the verifier entirely
> uncovered — so the per-file group is what makes the obligation falsifiable rather than decorative. It adds
> enforcement where there was none and lowers nothing, which is the only direction NFR17 permits.

> Assumption: the adapter set is **three** and a fourth is a scope change. AD-2's mechanical rule yields
> exactly `ui-link`, `ui-input` and `ui-button`; `ui-text-field-form` is a local composite that re-composes
> those seams rather than adapting a toolkit component, so counting it produced a cap that admitted a fourth
> adapter without a scope change — the opposite of what the cap is for.

> Assumption: FR37 needs **no architecture decision**, and that absence is recorded rather than left as a
> gap. It is a process obligation discharged entirely by upstream issue filings; the "Adapter deprecation"
> subsection carries its substance and now carries its trace. An untagged FR and a forgotten FR look
> identical from the outside, which is why the "no design needed" line exists.
