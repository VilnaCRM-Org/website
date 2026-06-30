---
name: quality-standards
description: >-
  Use when choosing, interpreting, or reacting to a VilnaCRM website quality gate
  — what each gate enforces, the required make format then make lint order, and
  which specialist skill fixes a given failure. Triggers: "which gate", "make
  format failed", "make lint failed", "make lint-next / lint-tsc / lint-md /
  lint-deps / lint-metrics failed", "is this CI-green", and any temptation to
  lower a threshold in config/metrics-policy.json or to silence a finding with
  eslint-disable, @ts-ignore, @ts-nocheck, @ts-expect-error, prettier-ignore, or
  markdownlint-disable. Routes each failing gate to its specialist skill.
---

# Quality Standards

This is the catalog of the website's quality gates: what each one enforces, the
order to run them, the policy that protects them, and which specialist skill
fixes each failure. For the full run-before-PR orchestration see
[../ci-workflow/SKILL.md](../ci-workflow/SKILL.md); for the test-coverage
contract see the root `agents.md`.

## Required Order

```bash
make format   # Prettier — mutates files, run FIRST
make lint     # ESLint + TypeScript + markdownlint + dependency-cruiser
```

`make format` runs Prettier **only** (no `qlty fmt`, no jscpd duplication pass —
neither is configured here). `make lint` is a verification gate, never a
mutating formatter. Run `make format` before any lint so Prettier output does not
re-trigger a lint failure. The complexity gate `make lint-metrics` is introduced by
issue #224 and is not yet on `main`; once #224 lands, run it as a separate hard gate
alongside `make lint` whenever you change `src/` code.

## Quality Gates

| Gate                    | Command             |
| ----------------------- | ------------------- |
| Format                  | `make format`       |
| ESLint                  | `make lint-next`    |
| TypeScript              | `make lint-tsc`     |
| Markdown                | `make lint-md`      |
| Architecture            | `make lint-deps`    |
| Metrics (planned, #224) | `make lint-metrics` |
| Aggregate               | `make lint`         |

`make lint` chains `lint-next`, `lint-tsc`, `lint-md`, and `lint-deps` in
sequence. `make lint-metrics` (rust-code-analysis, issue #224) is the complexity
gate and is **not** part of the `make lint` chain — treat it as an equal,
separate hard gate. See [reference/gate-catalog.md](reference/gate-catalog.md)
for what each gate enforces, its config file, and its common failures.

## Protected Policy

These invariants make a gate meaningful. Breaking one to go green is not done.

- Do not lower a threshold or exclude a file in
  `config/metrics-policy.json`. Reduce the
  complexity instead (see complexity-management).
- Do not silence findings with `eslint-disable`, `@ts-ignore`, `@ts-nocheck`,
  `@ts-expect-error`, `prettier-ignore`, or `markdownlint-disable`. Fix the root
  cause.
- Do not weaken a rule in `eslint.config.mjs`, `.dependency-cruiser.js`,
  `tsconfig.json`, or `.markdownlint.yaml` to make a change pass.
- Do not commit regenerated Playwright visual snapshots unless the visual change
  is intentional; regenerate with `make test-visual-update` and review the diff.
- Reuse Makefile targets — never invoke the underlying binary with relaxed flags
  to bypass a gate.

## Route Each Failure To Its Specialist

When a gate fails, hand the fix to the skill that owns that concern:

- **`make lint-next` / `make lint-tsc` / `make lint-md`** (ESLint, TypeScript, markdownlint)
  — [../frontend-quality-workflow/SKILL.md](../frontend-quality-workflow/SKILL.md) owns these
  gates; it routes a component, hook, form, or typing fix to
  [../frontend-component-development/SKILL.md](../frontend-component-development/SKILL.md), file
  placement or layering to [../code-organization/SKILL.md](../code-organization/SKILL.md), and
  doc drift to [../documentation-sync/SKILL.md](../documentation-sync/SKILL.md).
- **`make lint-deps`** (dependency-cruiser: `features-import-via-public-api`,
  `no-cross-feature-imports`, `feature-allowed-folders`,
  `src-feature-name-kebab-case`): [../architecture/SKILL.md](../architecture/SKILL.md)
  and [../code-organization/SKILL.md](../code-organization/SKILL.md).
- **`make lint-metrics`** (cyclomatic, cognitive, ABC, NARGS, NEXITS, Halstead,
  MI, file-size budgets): [../complexity-management/SKILL.md](../complexity-management/SKILL.md).
- **New or updated docs** (feature READMEs, agent guides, skill files):
  [../documentation-creation/SKILL.md](../documentation-creation/SKILL.md).
- **`make test-visual`** (visual regression) and Lighthouse budgets:
  [../figma-design-check/SKILL.md](../figma-design-check/SKILL.md) and
  [../frontend-performance-accessibility/SKILL.md](../frontend-performance-accessibility/SKILL.md).
- **Jest / Playwright e2e / Stryker** coverage and assertion gaps: the root
  `agents.md` test-scenario policy.
- **PR review comments** from `make pr-comments`: [../code-review/SKILL.md](../code-review/SKILL.md).

## Focused Test Gates

Run the suite that actually exercises the change; one change often needs more
than one. The root `agents.md` policy governs scenario coverage.

| Change type            | Command                  |
| ---------------------- | ------------------------ |
| Component or hook      | `make test-unit-client`  |
| Apollo server logic    | `make test-unit-server`  |
| Both unit layers       | `make test-unit-all`     |
| User-facing journey    | `make test-e2e`          |
| Rendered UI or styling | `make test-visual`       |
| Performance or a11y    | `make lighthouse-mobile` |
| Mutation strength      | `make test-mutation`     |
| Traffic or load        | `make test-load`         |
| Memory leaks           | `make test-memory-leak`  |

Any unit suite runs locally without Docker when prefixed with `CI=1` (for
example `CI=1 make test-unit-all`).

## Verification

```bash
make format          # Prettier (run first)
make lint            # ESLint + TypeScript + markdownlint + dependency-cruiser
make lint-metrics    # planned (#224), not yet on main; rust-code-analysis budgets, src/ changes
```

Then run the focused test gate(s) the change touches. Work is not done until the
relevant commands have actually been run and pass.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill
is consulted. The root `agents.md` test-coverage policy applies to any behavior a
change touches.

## Line Length Disclosure

Prettier `printWidth` is 100. Before presenting changes, check changed text files
for lines longer than 100 characters. If any exist, tell the user each
`path:line` and the measured character count. Treat this as disclosure, not
failure, unless a project gate fails.

## Supporting Files

- [reference/gate-catalog.md](reference/gate-catalog.md): each gate's command,
  config file, what it enforces, common failures, and owning specialist skill.
