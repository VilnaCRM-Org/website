# Shared UI primitives

Feature-agnostic building blocks (`ui-*` primitives plus `layout`, `seo`, `social-media`
and `app-theme`). They must not import from `src/features` (dependency-cruiser
`no-shared-ui-to-features`); the copy and data they render are passed in by the feature or
page that uses them.

## Conventions

- One directory per primitive, kebab-case, `ui-` prefix for a renderable primitive
  (`ui-breakpoints` and `ui-color-theme` export a configured MUI `Theme`, not a component).
- Props in a co-located `types.ts`; styles in a co-located `styles.ts` referenced through
  `sx={styles.name}` (ADR 0005 — no inline style objects, no comments in source).
- Every renderable primitive ships a `*.stories.tsx` (see `AGENTS.md`).
- Import through the `@/components` barrel from feature code.

## Notes

Rationale that used to live as comments in the source; the spec that pins each behaviour
is the place to look before changing it.

- **`seo`** — see [`docs/seo-surface.md`](../../docs/seo-surface.md). Props are declared in
  their own `types.ts` the way every other primitive here declares theirs.
- **`ui-input`, `ui-text-field-form`, `ui-typography`, `ui-link`, `social-media`** — the
  ARIA placement, live-region, autofill and link-hardening rules are in
  [`docs/sign-up-hardening.md`](../../docs/sign-up-hardening.md).
- **`ui-card-list`** — `card-swiper.tsx` mutates the carousel's DOM through its ref on
  purpose: it disables Swiper pointer events while a tooltip popper is mounted so the
  tooltip stays interactive over the carousel (mouse-only by design). The ref is aliased to
  a local so the write is not a parameter write. The optional `hoverCardContent` render
  slot in `types.ts` is how a feature injects a card's tooltip (the landing
  `ServicesHoverCard`) without the shared card components learning about the feature.
- **`ui-tooltip`** — `tooltip-wrapper.tsx` closes the tooltip when the viewport crosses a
  breakpoint by deriving state during render (React's "adjusting state on prop change"
  pattern) rather than in an effect, which avoids the extra render that
  set-state-in-effect flags. The set-state runs during render by design; it is not an
  effect.
- **`ui-typography`** — props are forwarded through an explicit allow-list, so anything a
  caller needs on the rendered element has to be named there; `aria-live` / `aria-atomic`
  are listed because the form validation message is a live region. Its `types.ts` splits
  a long union into two short ones so the file is stable under both the repo's Prettier
  and Qlty's.
- **`ui-image`** — `sx` is required: every consumer sizes the image, and the wrapper's own
  `img` rule is layered after it.
