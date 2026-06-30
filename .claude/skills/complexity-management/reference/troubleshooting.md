# Complexity Troubleshooting

## Formatter Made A File Fail Metrics

Keep Prettier output as-is. Look instead for duplicate style blocks, repeated
media queries, or dead exports that can be removed without changing behavior.
Never add `prettier-ignore` to dodge a metric.

## Extracted Helper Causes An Import Cycle

Move the helper to the lowest shared owner. If only one feature uses it, keep it
under that feature rather than promoting it to `src/utils`. Re-run
`make lint-deps` to confirm `no-circular`, `no-cross-feature-imports`, and
`features-import-via-public-api` still pass.

## Component Split Breaks Tests

Tests should target user-observable behavior with `getByRole`, `getByLabelText`,
`getByAltText`, or `getByText`, not the existence of a new child component. Assert
against localized `t()` strings so a split that moves rendering keeps
translation-sensitive coverage. Avoid asserting an internal child unless it is
exported as a public unit.

## The Gate Is Not Available Locally

`make lint-metrics` is host-only and is delivered with the rust-code-analysis
work in issue #224, which is **not yet on `main`**. If `config/metrics-policy.json`
or the target is missing on your branch, rebase onto the #224 branch that
introduces the gate rather than skipping the check. Do not run it inside the dev
Docker image — it has no Rust toolchain.

## Metrics Pass But Readability Got Worse

Passing the gate is a floor, not the only design goal. Prefer readable named
helpers and responsibility-based splits over arbitrary file slicing. If a change
satisfies the metric but obscures intent, choose a different boundary.
