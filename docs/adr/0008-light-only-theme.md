# ADR 0008: The site ships one light colour scheme and does not follow `prefers-color-scheme`

- **Status:** Accepted
- **Date:** 2026-09-17
- **Deciders:** website maintainers
- **Related:** issue #339 (usability audit, "dark-mode position is explicit"), issue #423
  (brand palette contrast), ADR 0005, `src/components/app-theme/index.ts`

## Context

Issue #339 recorded that the theme in `src/components/app-theme/index.ts` never sets
`palette.mode` or `colorSchemes`, that nothing in `src/` or `pages/` reads
`prefers-color-scheme`, and that whether this was a decision or an omission was written
down nowhere. The audit asked for one of two outcomes: adopt MUI `colorSchemes` with a
`prefers-color-scheme` media query, or record a light-only decision. This is the record.

The constraints that were real when it was made:

- **The palette is a single set of hand-picked hex values**, not tokens with a dark
  counterpart (`src/components/ui-color-theme/index.ts`: `primary #1EAEFF`,
  `secondary #FFC01E`, `darkPrimary #1A1C1E`, five greys). A second scheme would mean
  designing a second palette, and the existing one already fails WCAG 2.1 AA contrast on
  every route (#423, open). Doubling an unfinished palette doubles that debt.
- **The product screenshots are light rasters with copy baked in**
  (`src/features/landing/helpers/productScreenshots.ts`, one set per language). They are
  the LCP image and the for-who illustrations; a dark page around a white dashboard
  render is the one outcome worse than no dark mode, and re-rendering both language sets
  in a dark chrome is design work that does not exist.
- **The Swagger page is third-party markup styled by a light-only stylesheet**
  (`src/features/swagger/components/api-documentation/**/*.scss` overrides
  `swagger-ui-react`'s own light theme). Every colour there is a literal.
- **The visual-regression suite is the in-repo design reference.** Four Playwright
  projects (`chromium`, `firefox`, `webkit`, `mobile-chrome`) hold one light baseline
  per spec under `src/test/visual/**/*-snapshots/`, reviewed through CODEOWNERS. A
  second scheme would double every baseline and every review, and the Lighthouse
  budgets in `lighthouserc.desktop.js` / `lighthouserc.mobile.js` are calibrated on the
  light render alone.
- **The document already declares itself light.** `pages/_document.tsx` sets
  `<meta name="theme-color" content="#ffffff">` and
  `public/layout/favicon/site.webmanifest` sets `theme_color` and `background_color` to
  `#ffffff`; the installed PWA shell is white by contract.

The option genuinely available was to leave the status quo undocumented. The audit was
right that silence is the worst option: an agent extending the theme has no way to tell
an omission from a decision.

## Decision

We ship one light colour scheme. The theme sets neither `palette.mode` nor
`colorSchemes`, no code reads `prefers-color-scheme`, and no `color-scheme` meta or CSS
property is declared, so a browser or operating system in dark mode renders this site
exactly as one in light mode. The `theme-color` and manifest colours stay `#ffffff`.

Out of scope: a runtime theme switcher, a `color-scheme: light` declaration (it would
change how form controls and scrollbars render on dark-mode systems, which is a visual
change the baselines would have to absorb for no user benefit), and any change to the
palette values themselves, which #423 owns.

## Consequences

### What this buys

One palette to get to WCAG AA, one set of screenshots per language, one baseline per
spec per browser, one Lighthouse calibration. The Swagger overrides need no dark
counterpart. An agent reading the theme finds a recorded decision rather than a gap.

### What this costs

Visitors with a system-wide dark preference get a bright page. Operating-system dark
mode is common enough that this is a real, if minor, usability cost for a marketing
site, and the audit scored it as such. Anything that styles a native control by omission
— the sign-up inputs, the Swagger `<select>` — may show a light control inside a light
page on a dark-mode system, which is the intended appearance but not the one the user
chose.

### What would reverse it

A dark palette that passes AA on its own (which presupposes #423 is closed), dark
renders of the product screenshots in both languages, and a decision to fund the second
set of visual baselines. When those three exist, adopt MUI `colorSchemes` with
`prefers-color-scheme` rather than a manual switcher, update `theme-color` and the
manifest to per-scheme values, and supersede this record.
