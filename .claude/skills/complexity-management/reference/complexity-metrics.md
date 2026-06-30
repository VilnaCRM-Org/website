# Complexity Metrics

## How To Read A Violation

`make lint-metrics` reports each hard breach with the metric name, the measured
value, and the breached limit. Match the metric below to the refactoring move
that usually clears it. The exact numbers are not repeated here on purpose — the
authoritative thresholds live in
`config/metrics-policy.json` and the
README "Code Metrics (rust-code-analysis)" section. Read the policy file for the
current value.

## Hard Metrics You Will Hit Most

- **Cyclomatic** — count of independent branch paths in a function. Fix by
  extracting decision helpers or replacing branches with a lookup map.
- **Cognitive** — reader burden from nesting and control flow. Fix with guard
  clauses and smaller helpers.
- **ABC magnitude** — combined assignments, branches, and calls. Fix by splitting
  mixed responsibilities (data shaping vs rendering).
- **NARGS** — arguments per function or closure (a small limit). Fix by folding
  positional arguments into one typed options object.
- **NEXITS** — exit points per function (a small limit). Fix by consolidating
  early returns into guard clauses plus a single resolved return.
- **Function LLOC / PLOC / SLOC** — function size. Fix by extracting hooks or
  helpers.
- **Halstead volume / bugs** — operator and operand load. Fix by simplifying
  expressions and removing duplication.
- **File NOM / LLOC / PLOC / SLOC** — file size and member count. Fix by splitting
  the file by responsibility or deduplicating styles.
- **MI (maintainability index, Visual Studio)** — a floor, not a ceiling. A low MI
  usually clears once the size and Halstead breaches above are fixed.

## Review-Tier Metrics

Halstead submetrics, comment and blank ratios, and the original/SEI
maintainability indexes are computed as a **review** tier. They do not block CI
and are not printed as failures, but a cluster of review breaches is a strong
signal the same file needs the splits above.

## Policy Source

The only authoritative thresholds are in `config/metrics-policy.json`. Do not
change a threshold to pass a feature branch; the policy mirrors the CRM sister
repository's strict budgets and is a single cross-repo source of truth.
