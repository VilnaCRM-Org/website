# Lint Gates

## Commands

```bash
make lint-next      # ESLint (flat config; type-aware on src/**/*.{ts,tsx})
make lint-tsc       # TypeScript (tsc, strict + noUnusedLocals)
make lint-md        # markdownlint (**/*.md with the repo's ignore set)
make lint-deps      # dependency-cruiser over: src pages tests
make lint           # aggregate of the four gates above
make lint-metrics   # planned (#224), not yet on main; host-only, not in make lint
```

Run `make format` first, then the smallest failing gate while iterating, then the full
`make lint` before finishing. `make lint` runs `lint-next`, `lint-tsc`, `lint-md`, and
`lint-deps` in sequence and is read-only.

`make lint-metrics` is **not** part of `make lint`: it is a host-only gate planned for
issue #224 (not yet on `main`) and has no Docker/DinD wrapper. The CI alias `make ci-lint`
runs only `lint-next` + `lint-tsc` + `lint-md` in parallel (it omits `lint-deps`), so
always finish with the full `make lint` locally.

## Command Routing

Send each failure to the gate that owns it:

- Style/formatting diff — `make format` (Prettier), not a lint gate.
- Lint rule violation in JS/TS/TSX — `make lint-next` (ESLint).
- Type error, missing/incorrect types, unused locals — `make lint-tsc` (TypeScript).
- Heading, fenced-code language, list marker, or line-length issue in Markdown —
  `make lint-md` (markdownlint).
- Import boundary, circular dependency, orphan module, or non-kebab-case feature dir —
  `make lint-deps` (dependency-cruiser).
- Cyclomatic/cognitive/ABC/Halstead/MI or file-size budget on `src/` —
  `make lint-metrics` (see metrics-policy.md).

### dependency-cruiser boundaries

`make lint-deps` enforces the bulletproof-react feature layout. The most common failures
and their fixes:

- `features-import-via-public-api` — import a feature through its `index.ts` barrel, not a
  deep internal path.
- `no-cross-feature-imports` — do not import one feature's internals from another feature.
- `no-shared-ui-to-features` / `no-shared-layers-to-features` — shared UI (`src/components`)
  and shared layers must not depend on `src/features/*`.
- `src-feature-name-kebab-case` / `feature-allowed-folders` — keep feature directories
  kebab-case and within the allowed folder set.
- `no-circular` / `no-orphans` — break the import cycle or wire the orphan module into the
  public API.

Fix these by moving or re-exporting code, never by relaxing a rule in
`.dependency-cruiser.js`.

## Rule Suppressions

Do not add `eslint-disable`, `// @ts-ignore`, `// @ts-nocheck`, `prettier-ignore`, or
markdownlint disable directives, and do not weaken a dependency-cruiser rule or a metrics
threshold. Fix the code or the type contract so the rule's intent holds.

If a rule genuinely cannot apply because of an external constraint, raise it with the user
before silencing anything; never silence a gate to land a change.
