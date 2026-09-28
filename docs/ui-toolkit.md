# Shared UI primitives from `@vilnacrm/ui-toolkit`

Nine primitives under `src/components` render from
[`@vilnacrm/ui-toolkit`](https://github.com/VilnaCRM-Org/ui-toolkit) instead of a second
local copy of the same design: `UiButton`, `UiTypography`, `UiCheckbox`, `UiLink`,
`UiInput`, `UiToolbar`, `UiTooltip`, `UiColorTheme` and `UiBreakpoints`. The decision and
its cost are ADR 0012; this note holds the mechanism, which used to live as comments in
the source that ADR 0005 no longer allows.

## The import seam

Every `src/components/ui-*` directory that the toolkit replaced still exists. It is the
seam that keeps the `@/components` barrel and every call site untouched by the swap:
`ui-typography`, `ui-checkbox`, `ui-toolbar`, `ui-tooltip`, `ui-color-theme` and
`ui-breakpoints` are bare re-exports; `ui-button`, `ui-link` and `ui-input` are adapters
(below). Each seam imports the toolkit's **per-component subpath**
(`@vilnacrm/ui-toolkit/ui-button`), never the barrel.

The subpath is not a style preference. On the toolkit's barrel the static JS payload was
3,336,275 bytes against the 3,300,000-byte Lighthouse budget, because the toolkit's theme
modules call `createTheme` at module scope and a bundler cannot prove those calls pure —
importing one component through the barrel retained every theme in the kit. The subpaths
let each seam import only what it uses (3,156,094 bytes on the same build). The Jest
configs (`jest.config.ts`, `jest.mutation.config.ts`) map the subpaths straight to the
package's `build/<name>.mjs`, because the package is ESM-only and Jest's resolver does not
read the `import` condition of an `exports` map.

## The pin and the digest gate

The package is not on a registry. `package.json` pins the **release tarball URL** of one
GitHub release (`releases/download/v<version>/vilnacrm-ui-toolkit-<version>.tgz`). A git
ref cannot work: every entry point resolves into the toolkit's gitignored `build/`, and bun
installs neither a git dependency's devDependencies nor runs a build that needs them.

bun records **no `sha512`** for a remote-tarball dependency (the lockfile entry is
`[spec, {peerDependencies}]`, not the four-element registry form), and osv-scanner cannot
key such an entry either, so nothing local tied the URL to reviewed bytes.
`make lint-ui-toolkit` (`scripts/verifyUiToolkit.mjs`) is that check: it hashes every file
the installed package ships under `build/`, plus its `package.json`, and compares them with
`config/ui-toolkit-checksums.json`. It also refuses a pin that is not a release URL, a
digest file that names another version or URL than the manifest, an added file the digest
set does not know, and — deliberately — an absent `node_modules`: a gate that passes when
it cannot look reads as evidence. It is hermetic, so it runs inside `make lint` and
`CI_LINT_TARGETS` next to `lint-api-versions`.

To move the pin:

```bash
bun add https://github.com/VilnaCRM-Org/ui-toolkit/releases/download/v<v>/vilnacrm-ui-toolkit-<v>.tgz
make update-ui-toolkit   # rewrites config/ui-toolkit-checksums.json from the install
make lint-ui-toolkit
```

Review the release before refreshing the digests — `update-ui-toolkit` records whatever is
installed, so it must never be run to clear a red `lint-ui-toolkit`. The toolkit's own
`release provenance` workflow re-packs every published release from its tag and replaces
the asset with an attested tarball; refresh the digests from that final asset, not from a
tarball packed locally. The toolkit's automated release lane has never succeeded (its
release App is declined by `main`'s branch protection, ui-toolkit#162), so every release
so far was hand-cut; the recipe is recorded in ui-toolkit#181.

## Theme resolution

The toolkit's components style themselves through `useUiTheme()`: the ambient MUI theme
when it carries the toolkit's palette and typography tokens, otherwise the toolkit's own
`uiTheme`. This site's `src/components/app-theme` does not carry the typography variants,
so the toolkit's styles come from `uiTheme`, whose values are the ones the deleted local
themes carried.

MUI's own default styles still read the **ambient** theme, and one of them matters: a
contained `MuiButton` paints its label in `palette.primary.contrastText`. MUI derives that
from the brand blue `#1EAEFF` as dark text (contrast ratio to white is below its `3`
threshold), so the app theme pins `contrastText` to white — the same override the
toolkit's `uiTheme` carries. Wrapping the site in the toolkit's `UiThemeProvider` instead
would re-theme every MUI component on the site (default typography, spacing, shape), which
is a visual change this integration is supposed not to make.

## Body-copy tracking

MUI adds `letter-spacing` to its stock text variants only while the theme's font family is
Roboto; the toolkit's `uiTheme` names Golos, so a `UiTypography` rendered with no
`variant` — the notification title and description, the for-who card sub-heading — inherits
`normal` tracking from the toolkit, while this site's own app theme still resolves
`body1` at MUI's Roboto value. Those three styles pin `bodyLetterSpacing` from
`src/components/app-theme`, and the `ui-input` adapter layers the same value under the
consumer's `sx` (the toolkit's input sets `letter-spacing: inherit`, and the placeholder
inherits it), so the swap does not retighten body copy or placeholders the baselines already
hold; a design decision to drop that tracking is a one-line change there, made on purpose
and re-recorded, not a side effect of a dependency bump.

One more forwarding rule changed with v0.5.0: MUI hands a Tooltip's `sx` to its trigger
child, and the toolkit's trigger now carries an `sx` of its own, so a consumer `sx` on
`UiTooltip` no longer reaches the trigger text. Both call sites address the trigger by its
`role="button"` from the parent's styles instead: `ui-card-item`'s small-card text keeps the
link styling of the "services" trigger (`Trans` replaces that element's children with the
translated string, so nothing rendered inside it can carry the style), and the sign-up
form's label row keeps the `line-height: 0` that stops the 16px hint icon from adding a
text line's height to the row.

## Fonts

The toolkit's styles ask for `Inter` and `Golos Text` by name, through the CSS custom
properties `--ui-toolkit-font-inter` and `--ui-toolkit-font-golos` with those names as the
fallback. `next/font` generates an opaque family per import, which those references can
never resolve, so the faces are declared by hand in `styles/global.css` under their real
names against the same self-hosted `.woff2` assets, and `:root` sets the two custom
properties to the full stacks with their metric-adjusted fallbacks.

Two things `next/font` also gave the site are re-created rather than lost:

- **The metric-adjusted fallback faces** (`Inter Fallback`, `Golos Text Fallback`, Arial
  with `size-adjust` and the three `*-override` descriptors). Without them
  `font-display: swap` paints in Arial at Arial's metrics and reflows every line when the
  real face arrives — a CLS regression on every page. The values are the exact ones
  `next/font` emitted for these files, read off the built stylesheet of the last commit
  that used it; they are not re-derived, because a derivation landing a fraction of a
  percent away changes how every page paints before the swap. To recompute them if a
  regular face is ever replaced, derive from the new face's own metrics the way
  `next/font` did — `size-adjust` is the new face's average lowercase advance width over
  Arial's, and each `*-override` is the face's ascender, descender or line gap over
  `unitsPerEm`, divided by `size-adjust` — using any OpenType metrics reader for the
  `.woff2` and `next/font`'s bundled Arial table for the comparison.
- **The `<link rel="preload">` tags** for the six Golos weights, which `pages/_document.tsx`
  renders from `src/config/Fonts/preload.ts`. Dropping them lengthened the swap window: an
  LCP cost and a screenshot-stability hazard. `next.config.js` adds a webpack
  `asset/resource` rule so a `.woff2` can be imported for its URL under the same
  `static/media/[name].[hash:8][ext]` path Next already uses for fonts reached through
  CSS, so the stylesheet and the preload tag point at one copy per face — nine font files
  ship, not eighteen. `src/types/woff2.d.ts` declares the module shape for TypeScript.
  Inter is used only by the toolkit's own components and was never preloaded.

`GOLOS_TEXT_FAMILY` and `INTER_FAMILY` in `src/config/Fonts/families.ts` are the stacks the
site's own styled nodes use; every stack that names a real family carries its fallback
face too, for the reason above.

## The adapters

Each adapter re-adds a contract the toolkit forwards at runtime but does not model, and
each is tied to a committed regression test.

- **`ui-button`** keeps MUI's `href` contract: an empty `href` makes MUI render an `<a>`
  with no destination instead of the `<button>` the caller asked for, so a falsy `href`,
  `rel` or `target` is dropped rather than forwarded. v0.5.0 declares `rel` and `target`
  on its own prop type, so the local `types.ts` is a re-export.
- **`ui-link`** hardens `rel` through the shared `src/shared/externalLinkRel.ts` (#382 F2,
  `docs/sign-up-hardening.md`), which case-folds `target` before deciding, and localizes
  the new-tab cue: the toolkit requires `newTabLabel` with `target="_blank"` and this site
  renders no untranslated copy, so the adapter supplies `accessibility.opens_in_new_tab`
  unless the caller passed one. The toolkit's prop type is a union — `_blank` with a
  required label, or a same-tab keyword — so the local `types.ts` re-widens `target` to
  the string the call sites and the `_BLANK` regression test pass, and the adapter builds
  the union member itself. Spec: `src/test/testing-library/UiLink.test.tsx`,
  `AuthFormPolicyLinks.test.tsx`.
- **`ui-input`** is an explicit allow-list over the toolkit's prop type, not an `Omit`:
  the toolkit's props extend the whole of MUI's `TextFieldProps`, and subtracting a few
  names would hand every call site `slotProps` and `inputProps`, the seams this adapter
  owns to put `aria-describedby` and `aria-required` on the rendered `<input>` (#382 F3).
  `required` deliberately emits only `aria-required`, never the native attribute, which
  would hand validation to the browser and pre-empt the react-hook-form messages the
  suites assert. Spec: `AuthForm.test.tsx`, `AuthLayout.test.tsx`.

Tests changed with the swap did so for precision, not to pass: `UiCheckBox.test.tsx` read
`<style>.textContent`, which Emotion leaves empty in production mode (the mode `make`
runs the suite in); `AuthForm`/`AuthLayout` queried `role="status"` bare, which the
toolkit's always-present announcement region made vacuous; and `UiTooltip.test.tsx`
asserts the keyboard and ARIA contract (Enter/Space toggle, Escape close, `aria-expanded`)
the toolkit adds over the local tooltip it replaced.

## Visual baselines

The toolkit reproduces the Figma geometry the local themes only approximated, so the
baselines under `src/test/visual/**/*-snapshots/` change **for buttons only**:

- The header buttons render 50px tall. The local theme carried a unitless
  `line-height: 1.125` — a ratio, 16.88px at the 0.938rem label — so they were 48.89px,
  and its `1.438rem` horizontal padding was 23px against the design's 24px.
- The medium CTAs render 62px tall. Their label box is `1.375rem`; the local theme's
  unitless ratio gave 60px, and toolkit v0.4.0's `1.125rem` (right for the small button,
  wrong for the medium one, ui-toolkit#157) gave 58px.

Everything below a button that changed height moves by the height difference. That is
the whole diff: every re-recorded baseline was compared with `main`'s row by row, at
vertical offsets, and the rows that match at no offset are the button boxes and nothing
else. Verify a re-record the same way before committing it, and never regenerate
baselines to absorb a change you cannot name.
