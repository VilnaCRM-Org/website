---
name: frontend-quality-workflow
description: >-
  Use when running or fixing the website's formatting and lint gates — Prettier
  (make format), ESLint (make lint-next), TypeScript (make lint-tsc), markdownlint
  (make lint-md), dependency-cruiser (make lint-deps), or the rust-code-analysis
  metrics gate (make lint-metrics). Triggers: "make format / make lint failed",
  "fix ESLint / tsc / markdownlint / dependency-cruiser", "Prettier rewrote files",
  "lint-deps boundary violation", "lint-metrics complexity FAIL", before commit or PR.
---

# Frontend Quality Workflow

How to take a website change from "edited" to "lint-clean" — the format-then-lint
order, and the per-tool fix for each gate. Every command is a Makefile target run
from the repo root (this repo exposes its toolchain through the Makefile, not
`package.json` scripts).

Scope boundary: this skill owns the **formatting and lint gates**. For _which test
suites_ to run and in what order, defer to the `ci-workflow` skill. For the depth of
_reducing complexity_ to clear `make lint-metrics`, defer to the
`complexity-management` skill. The root [agents.md](../../../agents.md) test-coverage
policy applies to any behavior these fixes touch.

## Required Order

Run the one mutating step first, then the read-only gates:

```bash
make format   # Prettier rewrites formatting — must run before lint
make lint     # read-only gate: ESLint + TypeScript + markdownlint + dependency-cruiser
```

`make format` runs **Prettier only** across the repo's JS/JSX, TS/TSX, JSON, CSS/SCSS,
and Markdown (honoring `.prettierignore`). `make lint` never mutates; it fails if
anything is off. Formatting before linting means the gate validates already-formatted
code, so a Prettier rewrite can never invalidate a green run.

The aggregate `make lint` is `lint-next` + `lint-tsc` + `lint-md` + `lint-deps`. The
rust-code-analysis metrics gate (`make lint-metrics`) is a **separate, host-only** gate
(delivered by issue #224); it is intentionally not part of `make lint`. Run it
explicitly when a change to `src/` could grow complexity.

Locally, prefix any gate with `CI=1` to run it directly without Docker (for example
`CI=1 make lint-next`).

## Fix Each Gate At Its Source

- **Prettier** (`make format`) — re-run the target and review the rewritten files; never
  hand-format or add `prettier-ignore`. Committed Markdown (including `.claude/skills/**`,
  which markdownlint skips) is Prettier-formatted, so keep any embedded `ts`/`tsx`/`json`
  fences valid and Prettier-clean; use a `text` fence for partial or pseudo snippets.
- **ESLint** (`make lint-next`) — fix the flagged rule in code. Type-aware rules run on
  `src/**/*.{ts,tsx}`. Never add `eslint-disable`.
- **TypeScript** (`make lint-tsc`) — fix the type contract; `tsc` runs under `strict` with
  `noUnusedLocals`. Keep types honest and avoid `any` unless an external boundary forces
  it. Never add `@ts-ignore` or `@ts-nocheck`.
- **markdownlint** (`make lint-md`) — keep ATX headings, fenced-code languages, list
  markers, and line length compliant. Note `CLAUDE.md` is `-i`-ignored and `_bmad/**` /
  `bmalph/**` / `specs/**` are excluded, but top-level guides are scanned.
- **dependency-cruiser** (`make lint-deps`, over `src pages tests`) — respect feature
  boundaries: import features via their `index.ts` barrel (`features-import-via-public-api`),
  never deep-import across features (`no-cross-feature-imports`), keep shared layers and
  shared UI from importing features (`no-shared-layers-to-features`,
  `no-shared-ui-to-features`), and keep feature directories kebab-case
  (`src-feature-name-kebab-case`). Move the code instead of relaxing the rule.
- **Metrics gate** (`make lint-metrics`) — Mozilla rust-code-analysis enforces complexity
  budgets from `config/metrics-policy.json`. Reduce
  the complexity (extract a helper, use a typed lookup map, split a file by owner); never
  lower a threshold or exclude a file. See `complexity-management` for the refactoring
  moves and [reference/metrics-policy.md](reference/metrics-policy.md) for the tiers.

## Fix Rules

- Prefer a code change over disabling a rule.
- Keep TypeScript types honest; avoid `any` unless the boundary genuinely requires it.
- Keep a skill's Markdown frontmatter to `name` and `description` only.
- Split complex components, hooks, helpers, and `styles.ts` files instead of lowering the
  metrics policy.
- After each focused fix, re-run the smallest failing check, then `make lint` (plus
  `make lint-metrics` if `src/` complexity could have moved) before finishing.

## Never Weaken A Gate

A passing run achieved by lowering the bar is a failing change. Do not add
`eslint-disable`, `prettier-ignore`, `@ts-ignore` / `@ts-nocheck`, or markdownlint disable
directives; do not relax a dependency-cruiser rule or lower a metrics threshold. Fix the
code, or record a concrete `Not applicable: <reason>` per agents.md.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill is
consulted. Pair this with `ci-workflow` (suite selection and order) and
`complexity-management` (metrics refactoring).

## Line Length Disclosure

Prettier `printWidth` is 100. Before presenting changes, check changed text files for
lines longer than 100 characters. If any exist, tell the user each `path:line` and the
measured character count. Treat this as disclosure, not failure, unless a project gate
fails.

## Supporting Files

- [reference/formatting-tools.md](reference/formatting-tools.md): `make format` behavior
  and the Prettier config.
- [reference/lint-gates.md](reference/lint-gates.md): lint command routing and suppression
  policy.
- [reference/metrics-policy.md](reference/metrics-policy.md): the rust-code-analysis gate,
  its tiers, and common fixes.
