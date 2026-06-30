# Complexity Quick Start

> **Status:** `make lint-metrics` is the gate introduced by issue #224 and is **not yet on
> `main`**. The commands below become runnable once #224 lands.

## Triage

```bash
make lint-metrics
```

This host-only target auto-installs the pinned rust-code-analysis CLI to `./bin`
on first run, analyzes `src/`, and prints any hard violations. Each `FAIL` row has
eight columns:

```text
GATE  FILE  SCOPE  SUBJECT  LINE  METRIC  VALUE  LIMIT
```

Read the row as: the `METRIC` measured `VALUE` for `SUBJECT` (a function, closure,
or file) at `FILE:LINE`, which breaches `LIMIT`. Only hard `FAIL` rows block CI;
review-tier metrics are computed but not printed.

## Fix Path

1. If `SCOPE` is `function` or `closure`, extract a pure helper or replace
   branches with a lookup map; collapse early returns to reduce NEXITS.
2. If the breach is NARGS, fold the arguments into one typed options object.
3. If `SCOPE` is `file`, split by responsibility (container vs view, or a
   `styles.ts` into modules).
4. Re-run `make lint-metrics`, then `make lint`.

## Common One-Line Fixes

- Hoist a static array, map, or `sx` object out of render to module scope.
- Deduplicate identical style objects and repeated media queries.
- Replace a nested ternary with a named helper.
- Remove a dead branch after confirming it is unreachable.

See [../refactoring-strategies.md](../refactoring-strategies.md) for each pattern
in full.
