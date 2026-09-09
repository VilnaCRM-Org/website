---
name: complexity-management
description: Use when a TypeScript/TSX file, React component, hook, helper, validation, or styles file under src/ exceeds the rust-code-analysis complexity gate (make lint-metrics, config/metrics-policy.json) — cyclomatic, cognitive, ABC, NARGS, NEXITS, Halstead, MI, or file-size budgets — and needs refactoring (extract helper, lookup map, typed options object, split file, consolidate exits) without lowering thresholds.
---

# Complexity Management

## Protected Gate

Issue #224 introduces a rust-code-analysis complexity gate (`make lint-metrics`).
The authoritative thresholds live in `config/metrics-policy.json` (validated
against `config/metrics-policy.schema.json`) and are mirrored from the CRM sister
repository's strict budgets. The same policy file is applied identically by the
local target and the CI workflow `.github/workflows/rust-code-analysis.yml`. It is
not yet on `main`; treat the budgets below as the policy once #224 lands.

Do not lower a threshold, exclude a file, or suppress a metric to make a change
pass. Reduce the complexity instead. The policy file is the single source of
truth — read it for the current numbers rather than memorizing them.

The gate has two tiers: **hard** metrics block CI (printed as `FAIL` rows), and
**review** metrics are computed but do not block. Treat a hard violation as work
that is not done.

## Common Frontend Hotspots

- Large component bodies that mix Apollo data loading, react-hook-form state, and
  rendering in one function.
- Hooks with many conditional branches (cyclomatic / cognitive).
- Validation functions co-located with a component
  (`components/<name>/validations/`) with dense boolean logic.
- Render functions or callbacks taking too many positional arguments (NARGS).
- Functions with many early returns (NEXITS).
- A single `styles.ts` that has grown to hold every variant for a feature (file
  size and Halstead budgets).

## Refactoring Moves

The five patterns below each target a specific gate metric. See
[refactoring-strategies.md](refactoring-strategies.md) for worked examples.

- **Extract helper** — pull dense boolean or data-shaping logic out of JSX and
  hooks into a pure function. Reduces cyclomatic, cognitive, and function size.
- **Lookup map** — replace `if`/`switch` over a finite status union with a typed
  `Record<...>`. Reduces cyclomatic and cognitive.
- **Typed options object** — collapse 4+ positional arguments into one typed
  `{ ... }` parameter. Reduces NARGS (limit is small — see the policy).
- **Split file** — divide an oversized file by responsibility (subcomponents,
  hooks, or a `styles.ts` into `styles.layout.ts` / `styles.screens.ts` /
  `styles.shapes.ts`). Reduces file NOM / LLOC / PLOC / SLOC and raises MI.
- **Consolidate exits** — replace scattered early returns with guard clauses plus
  one resolved return (often via a lookup map). Reduces NEXITS.

Split by ownership and responsibility, never by an arbitrary line count.

## Verification

`make lint-metrics` is the issue #224 gate and is not yet on `main`; the step below
becomes runnable once #224 lands.

```bash
make lint-metrics
make lint
```

Run `make format` first so Prettier output does not surprise the metrics pass.
Run `make lint` after splitting files, because moving code also affects ESLint,
TypeScript, and dependency-cruiser (`features-import-via-public-api`,
`no-cross-feature-imports`). If UI behavior changes while reducing complexity,
run the focused suite that covers the path: `make test-unit-client`,
`make test-e2e`, or `make test-visual`.

## Conventions To Respect While Refactoring

- Keep imports through a feature's public API barrel
  (`src/features/<feature>/index.ts`); do not introduce deep cross-feature paths
  when extracting helpers.
- Feature directory names are **kebab-case** (enforced by
  `src-feature-name-kebab-case` in `.dependency-cruiser.js`). Shared UI components
  currently use the `Ui*` PascalCase prefix (for example `src/components/UiButton`)
  and are being migrated to the kebab-case `ui-*` target convention; that rename is
  not yet universally enforced.
- A helper used by one feature belongs under that feature, not `src/utils`.
- Assert localized text via the i18next `t()` helper, not hardcoded English, so a
  split that touches rendering keeps translation-sensitive behavior covered.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill
is consulted. The root `AGENTS.md` test-coverage policy still applies to any
behavior the refactor touches.

## Line Length Disclosure

Prettier `printWidth` is 100. Before presenting changes, check changed text files
for lines longer than 100 characters. If any exist, tell the user each
`path:line` and the measured character count. Treat this as disclosure, not
failure, unless a project gate fails.

## Supporting Files

- [refactoring-strategies.md](refactoring-strategies.md): the five refactoring
  patterns with website examples.
- [reference/quick-start.md](reference/quick-start.md): fast triage path.
- [reference/analysis-tools.md](reference/analysis-tools.md): commands for
  running the gate and finding related code.
- [reference/complexity-metrics.md](reference/complexity-metrics.md): metric
  meanings and the move that usually fixes each.
- [reference/project-configuration.md](reference/project-configuration.md):
  scope, excludes, related files, and the update rule.
- [reference/troubleshooting.md](reference/troubleshooting.md): common failure
  modes while reducing complexity.
