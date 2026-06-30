# Analysis Tools

## Primary Gate

```bash
make lint-metrics
```

Runs rust-code-analysis against `src/` using `config/metrics-policy.json`. It is
host-only and deliberately kept out of `make lint` and the CI lint aggregate, so
run it explicitly. CI runs the same policy through
`.github/workflows/rust-code-analysis.yml`.

## Full Quality Gate

```bash
make format
make lint
```

Run this after complexity changes, because splitting files also affects ESLint,
TypeScript, markdownlint, and dependency-cruiser (`make lint` aggregates
`lint-next`, `lint-tsc`, `lint-md`, and `lint-deps`).

## Locate Related Code Before Moving It

Map the components, hooks, and styles involved before extracting or splitting:

```bash
grep -rn "export function\|export const" src/features
grep -rln "styled(\|sx=" src/features
grep -rn "use[A-Z]" src/features src/hooks
```

Search before refactoring so a helper lands at the lowest shared owner and you do
not create a cross-feature import that `make lint-deps` would reject.
