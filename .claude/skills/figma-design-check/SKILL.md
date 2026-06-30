---
name: figma-design-check
description: Use BEFORE building or editing any website UI — MUI 9 + Emotion components, layout, color/fill/border, spacing, typography, sizing, icons, or interaction states (default/hover/focus-visible/active/disabled/loading/error) — to verify the planned change matches its design reference. Compare against the repo theme tokens (UiColorTheme palette, UiTypography, UiBreakpoints) and the Playwright visual baselines via `make test-visual` / `make test-visual-update`. Run this design-fidelity gate before frontend-component-development and before any `src/features/*` or `src/components/*` UI edit.
---

# Figma Design Check

A lightweight design-fidelity gate: verify every UI change against its design reference
**before** implementing it, then re-verify the rendered result against the repo's Playwright
visual baselines. The design is the source of truth for visuals; the implementation must match
it (or the user must explicitly approve a deviation).

This is a review workflow, not a tool integration. The repo does not configure a Figma MCP
server, so a design reference can be a `figma.com` file/node URL, an exported screenshot, a
design-handoff spec, or the existing visual baseline. If a Figma MCP is available in the
session you may pull the node with it (see Reference), but the gate works without one.

## When to use (mandatory before UI changes)

Run this before ANY change that affects what the user sees: a new or modified MUI 9 + Emotion
component under `src/components/ui-*` or `src/features/<feature>/components/`, layout, color,
fill, border, radius, spacing, typography, sizing, icons, or any interaction state the design
defines (default / hover / focus-visible / active / disabled / loading / error). It runs
**before** `frontend-component-development` and before any UI edit.

It does NOT apply to pure logic, data-layer (Apollo/GraphQL), i18n-only string, test-only, or
non-visual config changes.

## Prerequisite: a design reference

You need a design reference for the affected surface. If none is available, **ask the user for
the design link or confirm there is no design for this surface before implementing** — do not
silently guess the intended look. When the only reference is the current visual baseline under
`src/test/visual/**/*-snapshots/`, treat that baseline as the contract: a change that alters it
is a deliberate redesign that must be approved and the baseline regenerated, not a drift.

## Workflow

1. **Identify the surface and its design node.** Map the component/screen you are about to
   change to the corresponding design frame and to its place in the tree
   (`src/features/<feature>/components/...` or shared `src/components/ui-*`).
2. **Pull the design reference.** Read the provided Figma link / exported spec / screenshot.
   If a Figma MCP is loaded this session, you may fetch structured context and tokens with it
   (tool names and the optional flow are in `reference/design-token-map.md`). Otherwise work
   from the supplied spec and the current baseline.
3. **Compare field by field against the repo's theme tokens**, not raw values: fill/background,
   text/label color, border + radius, spacing/padding, typography (family, size, weight,
   line-height, letter-spacing), responsive sizing, and **every interaction state** the design
   defines (not just default). Website tokens live in the MUI theme, not in a flat colors file:
   - Colors → `src/components/UiColorTheme` palette (e.g. `palette.primary.main = '#1EAEFF'`).
   - Typography → `src/components/UiTypography/theme.ts` (Golos/Inter via `@/config/Fonts`).
   - Breakpoints → `src/components/UiBreakpoints` (`xs 375 / sm 640 / md 768 / lg 1024 / xl 1440`).
   - Per-component variants + state styles → that component's `theme.ts` / Emotion `styles.ts`
     (`&:hover`, `&:active`, `&:disabled`, ...).

   ```ts
   import breakpointsTheme from '@/components/UiBreakpoints';
   import colorTheme from '@/components/UiColorTheme';

   // Map a design value to the existing token instead of pasting a raw hex/px literal.
   const primaryFill = colorTheme.palette.primary.main; // '#1EAEFF'
   const mobileBreak = breakpointsTheme.breakpoints.values.sm; // 640
   ```

4. **Decide:**
   - **Match** → proceed with the implementation.
   - **Divergence** → STOP. Surface the specific discrepancy (design value vs planned value) to
     the user and get a decision. The design wins unless the user explicitly overrides; record
     the override. A divergence-report shape is in `reference/design-token-map.md`.
   - **No design exists for this surface** → tell the user and confirm the intended look before
     coding.
5. **After implementing, re-verify against the design and the visual baseline.** Run
   `make test-visual` (Playwright across chromium / firefox / webkit, at the viewports in
   `src/test/visual/constants.ts`). If the change is a deliberate, approved redesign that moves
   the baseline, regenerate it with `make test-visual-update` and review the pixel diff before
   committing. For an interactive spot-check you may drive the page with
   `browser-testing-with-devtools` (Chrome DevTools MCP).

   ```bash
   make test-visual          # compare the rendered UI to the committed baselines
   make test-visual-update   # regenerate baselines only for an approved redesign
   ```

## Notes

- This is a **verification gate**, distinct from `pix` (the autonomous pixel-perfect
  design→code loop). Use `pix` when you want the full automated loop; use this skill as the
  lightweight "does my planned change match the design?" check before editing.
- A design match does **not** waive accessibility. UI changes still require the
  `frontend-performance-accessibility` review (contrast, focus-visible, semantics), and editing
  `.tsx` UI is gated on that review running first. If the design itself fails a WCAG gate (for
  example, insufficient contrast), flag it to the user — accessibility can override the visual.
- Never loosen a visual assertion (no `maxDiffPixels`, no skipped projects) to force a stale
  baseline to pass; a real visual delta is either a bug to fix or an approved redesign to
  re-baseline. See the webkit baseline-drift caveat in `reference/design-token-map.md`.
- Keep evidence in your response: which design node you checked, the token values compared,
  the match/divergence outcome, and the `make test-visual` result.

See `reference/design-token-map.md` for the full token-location map, the optional Figma MCP
flow, the field-by-field comparison checklist, and a divergence-report template.
