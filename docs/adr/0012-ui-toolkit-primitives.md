# ADR 0012: Shared UI primitives render from `@vilnacrm/ui-toolkit`

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** website maintainers
- **Related:** issue #458, PR #459, ADR 0005, [`docs/ui-toolkit.md`](../ui-toolkit.md),
  `VilnaCRM-Org/ui-toolkit` (issues #152, #153, #154, #157, #162, #181)

## Context

`src/components` carried a second implementation of the design system the CRM already
ships from `VilnaCRM-Org/ui-toolkit`: the same palette, the same breakpoints, the same
button, link, input, checkbox, tooltip, toolbar and typography, each with its own MUI
theme. Two copies drift. The header buttons rendered 48.89px tall against a 50px design
because the local button theme spelled its line height as a unitless ratio; the medium
CTAs were 60px against 62px for the same reason; a `_BLANK` link opened a new tab with no
`rel`; the tooltip had no keyboard path. Each fix would have had to land twice.

The constraints that were real when the swap was made:

- **The toolkit is consumable only as a release tarball.** Its entry points resolve into
  a gitignored `build/`, and bun installs a git dependency without its devDependencies,
  so a `prepare` build cannot rescue a git ref. bun records no integrity hash for a
  remote tarball, so the pin alone proves nothing about the bytes.
- **The toolkit's release automation has never succeeded** (its release App is declined
  by `main`'s branch protection, ui-toolkit#162). Every release consumed here was cut by
  hand.
- **Importing the toolkit's barrel breached the Lighthouse JS budget** by 36 KB, because
  its module-scope `createTheme` calls cannot be tree-shaken. v0.4.0 added per-component
  subpaths, which is what made the swap affordable.
- **The toolkit asks for its fonts by family name**, which `next/font`'s generated names
  can never satisfy.
- **This repository tests three contracts the toolkit does not model**: case-folded
  `rel` hardening (#382 F2), `aria-describedby`/`aria-required` on the rendered
  `<input>` (#382 F3), and a localized new-tab cue.

The options genuinely available were to keep the fork and port each toolkit fix by hand,
or to consume the toolkit and keep only what it does not model.

## Decision

We render `UiButton`, `UiTypography`, `UiCheckbox`, `UiLink`, `UiInput`, `UiToolbar`,
`UiTooltip`, `UiColorTheme` and `UiBreakpoints` from the pinned `@vilnacrm/ui-toolkit`
release, through the existing `src/components/ui-*` directories as import seams. Three
seams are adapters that re-add the tested contracts above; the rest are re-exports. The
pin is a release-tarball URL, and `make lint-ui-toolkit` verifies the installed build
against committed SHA-256 digests on every pull request. The faces the toolkit names are
declared in `styles/global.css` under their real names, with the metric-adjusted fallbacks
and preload tags `next/font` used to provide re-created by hand.

A geometry or behaviour defect in a toolkit component is fixed upstream and the pin
bumped. It is never patched over with a local `sx`, a local theme or a widened adapter —
that would re-fork exactly what this decision consolidates.

Out of scope: the rest of `src/components` (cards, images, the skip link, the layout),
which have no toolkit counterpart yet; wrapping the site in the toolkit's
`UiThemeProvider`, which would re-theme every MUI component on the site.

## Consequences

### What this buys

One source of geometry, so the buttons now match the design file to the pixel and a
correction lands once. The toolkit's accessibility work — keyboard-operable tooltip,
`aria-expanded`, the new-tab cue — arrives with the pin instead of being re-implemented.
The delta between this site and the CRM's chrome becomes a version number.

### What this costs

- **Release cadence is coupled to a lane that does not work.** A toolkit fix this site
  needs means a hand-cut release: bump, tag, pack, publish, wait for the provenance
  workflow to re-attest, then refresh the digests here. Until ui-toolkit#162 is resolved
  by an admin, that is a manual runbook (ui-toolkit#181).
- **The digest gate is maintenance.** Every pin bump rewrites
  `config/ui-toolkit-checksums.json` (hundreds of lines), and the review of that diff is
  the only integrity check the dependency has.
- **Fonts are declared by hand.** The fallback metrics are copied values; replacing a
  face means recomputing them (`docs/ui-toolkit.md`, "Fonts").
- **Jest needs a module map** for the ESM-only subpaths, in two configs.
- **Baselines move when the toolkit corrects geometry**, and each move must be proved to
  be the correction and nothing else before it is committed.

### What would reverse it

The toolkit diverging from the Figma file this site is measured against; the toolkit's
bundle growing past what the subpaths can keep under the Lighthouse budget; or the
toolkit being abandoned, at which point the seams are where the local implementations
return.
