# Design Token Map & Fidelity Reference

Supporting detail for `figma-design-check`. The website does not keep a flat `colors.ts`; visual
constants live in the MUI 9 theme and in per-component Emotion style objects. Map every design
value to one of these tokens instead of pasting a raw hex/px literal into a component.

## Where each design dimension lives

| Design dimension                | Repo source of truth                                     |
| ------------------------------- | -------------------------------------------------------- |
| Color / fill / border color     | `src/components/UiColorTheme` (`palette.*.main`)         |
| Typography (family/size/weight) | `src/components/UiTypography/theme.ts`                   |
| Font families                   | `src/config/Fonts/golos.ts`, `src/config/Fonts/inter.ts` |
| Breakpoints / responsive sizing | `src/components/UiBreakpoints` (`breakpoints.values`)    |
| Composed app theme              | `src/components/AppTheme` (palette + breakpoints + MUI)  |
| Per-component variants + states | that component's `theme.ts` / `styles.ts` (Emotion)      |
| Rendered-pixel contract         | `src/test/visual/**/*-snapshots/` (Playwright baselines) |

Palette names are domain tokens, not generic Material names — e.g. `primary` (`#1EAEFF`),
`secondary` (`#FFC01E`), `error` (`#DC3939`), plus `containedButtonHover`, `containedButtonActive`,
`textLinkHover`, `brandGray`, and the `grey200`–`grey500` ramp. Breakpoints are
`xs 375 / sm 640 / md 768 / lg 1024 / xl 1440`.

```ts
import colorTheme from '@/components/UiColorTheme';

// Interaction states live on the component variant object, one key per state.
export const containedStyles = {
  backgroundColor: colorTheme.palette.primary.main, // default fill '#1EAEFF'
  borderRadius: '3.563rem',
  '&:hover': { backgroundColor: colorTheme.palette.containedButtonHover.main },
  '&:active': { backgroundColor: colorTheme.palette.containedButtonActive.main },
  '&:disabled': {
    backgroundColor: colorTheme.palette.brandGray.main,
    color: colorTheme.palette.white.main,
  },
};
```

If the design needs a value that has no token yet, raise it: add the token to the theme rather
than hardcoding it in the component, so the next design check can compare against it.

## Optional Figma MCP flow (only if loaded this session)

The repo configures no Figma MCP server, so do not assume these exist. If a Figma MCP is loaded
in the session and a `figma.com` link or node selection is provided, you may load the tool
schemas with ToolSearch and pull the node before comparing:

- `mcp__figma__get_design_context` — structured design + code context for the node.
- `mcp__figma__get_screenshot` — the rendered visual to compare against.
- `mcp__figma__get_variable_defs` — design tokens (colors, spacing, radii, type) to diff against
  the `UiColorTheme` / `UiTypography` / `UiBreakpoints` values above.
- `mcp__figma__get_metadata` — node structure/hierarchy when needed.

When no Figma MCP is available, work from the supplied screenshot/spec and the committed visual
baseline; the comparison checklist below is identical either way.

## Field-by-field comparison checklist

Walk every row that the change can reach. "Token" means the repo source above, not a raw value.

```text
[ ] Fill / background      design value  vs  palette token
[ ] Text / label color     design value  vs  palette token
[ ] Border color + width    design value  vs  palette token + style object
[ ] Border radius           design value  vs  style object (e.g. '3.563rem')
[ ] Spacing / padding       design value  vs  style object / theme spacing
[ ] Font family             design value  vs  golos / inter
[ ] Font size / weight      design value  vs  UiTypography variant
[ ] Line-height / tracking  design value  vs  UiTypography variant
[ ] Responsive sizing       design breakpoints  vs  UiBreakpoints values
[ ] Icon / asset            design asset  vs  src/assets / public
[ ] State: hover            design state  vs  '&:hover'
[ ] State: focus-visible    design state  vs  '&:focus-visible'
[ ] State: active           design state  vs  '&:active'
[ ] State: disabled         design state  vs  '&:disabled'
[ ] State: loading / error  design state  vs  component branch
```

## Divergence-report template

When a value cannot match the design, STOP and surface it in this shape, then get a decision:

```text
Surface: <component / screen> (<feature path>)
Design node: <figma url / node id / spec reference>

Discrepancy:
- Field: <e.g. primary button fill>
  Design: <value or token>
  Planned/current: <value or token>
  Reason: <why it cannot match as specified>

Proposed resolution: <match the design | approved override + rationale>
Decision needed from user: yes
```

Record the user's decision (and any explicit override) in your task summary.

## Verifying against the visual baseline

After implementing, re-render and compare against the committed Playwright baselines:

```bash
make test-visual          # chromium / firefox / webkit, viewports in constants.ts
make test-visual-update   # regenerate baselines ONLY for an approved redesign
```

Baselines live next to each spec in `src/test/visual/**/*-snapshots/`, one PNG per
browser + viewport. Treat a failing visual diff as signal, not noise:

- Unintended diff → a fidelity bug; fix the component, do not re-baseline.
- Intended, approved redesign → run `make test-visual-update`, review the diff, commit the new
  baseline alongside the code.

Never paper over a diff by loosening the assertion: do not add `maxDiffPixels`, raise a
threshold, or skip a browser project. One known exception is genuine cross-engine drift — a
Playwright/WebKit upgrade can shift webkit baselines by a couple of pixels with no real visual
change; regenerate those baselines deliberately (Docker, single worker) rather than masking the
diff. This keeps the baseline an honest contract.
