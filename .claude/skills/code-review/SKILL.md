---
name: code-review
description: >-
  Use when retrieving, triaging, or resolving GitHub PR review comments in the website repo
  via make pr-comments (PR=<num>, FORMAT=text|json|markdown) — categorize each finding
  (committable suggestion, bug, architecture, complexity, test gap, question), route it to the
  right specialist skill, then re-validate with make format, focused Jest/Playwright suites,
  and make lint.
---

# Code Review Workflow (PR Comments)

Pull unresolved PR review comments, triage each one, fix it at the right level, and
re-validate with the project gates. The command surface is the website Makefile;
`make pr-comments` wraps `scripts/get-pr-comments.sh`.

## Quick Start

```bash
make pr-comments                       # auto-detect PR from the current branch, text output
make pr-comments PR=304                # explicit PR number
make pr-comments FORMAT=json           # machine-readable for tooling
make pr-comments PR=304 FORMAT=markdown # paste-ready summary
```

- `FORMAT` is `text` (default, human-readable), `json`, or `markdown`.
- With no `PR`, the script auto-detects the PR for the checked-out branch.
- Needs an authenticated `gh` (`gh auth status`) and `jq` on `PATH`.

Resolve comments in priority order — reproduce bugs first, then committable
suggestions, then architecture, complexity, and test gaps — and finish with the
verification gate below.

## Categorize And Route

Read every comment before changing code. Classify each finding, then route it to the
companion skill that owns that concern instead of patching in place.

| Finding category       | How to resolve                                               |
| ---------------------- | ------------------------------------------------------------ |
| Committable suggestion | Apply only if correct for the nearby code, then re-verify    |
| Bug or regression      | Reproduce with a failing test, fix, keep the test            |
| Architecture concern   | Use the `code-organization` skill; re-check `make lint-deps` |
| Complexity concern     | Use the `complexity-management` skill; watch qlty smells     |
| Test gap               | Add coverage per `agents.md` at the smallest useful layer    |
| Question               | Answer in the thread or make the code self-explanatory       |

Architecture comments (cross-feature imports, deep paths past a feature barrel,
shared-layer-into-feature edges) map to the real `.dependency-cruiser.js` rules
surfaced by `make lint-deps`. Complexity comments map to the qlty `[smells]` analyzer
configured in `.qlty/qlty.toml`, which posts as PR bot comments — reduce the function,
do not silence the bot.

## Verification

Run `make format` (Prettier) before `make lint` so formatting churn never trips the
lint gate. Then run the focused suites the comments actually touched.

```bash
make format                  # Prettier (run before lint)
make lint                    # ESLint + tsc + markdownlint + dependency-cruiser
```

Add the layer that exercises the change. Prefix unit suites with `CI=1` to run them
locally without Docker.

```bash
CI=1 make test-unit-client   # components, hooks, client logic (jsdom)
CI=1 make test-unit-server   # Apollo resolvers and server logic (node)
make test-e2e                # user-facing flows (Playwright + Mockoon)
make test-visual             # rendered UI or styling changes (Playwright)
```

For a deliberate, reviewed UI change that left its baselines stale, regenerate with
`make test-visual-update` and inspect the diff before committing — never blanket-update
snapshots to clear a red check.

## Rules

- Do not apply a suggestion blindly; read the surrounding feature first.
- Do not weaken a gate to win silence: no lowering of `eslint.config.mjs`,
  `tsconfig.json`, `.dependency-cruiser.js`, `.markdownlint.yaml`, or the
  `.qlty/qlty.toml` smell thresholds.
- Do not add `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`,
  `prettier-ignore`, or `markdownlint-disable`; fix the underlying code or type instead.
- Assert user-facing behavior (`getByRole`, `getByLabelText`, `getByText`, localized
  `t()` strings), not implementation details — see `agents.md`.
- Re-run `make pr-comments` before declaring the review resolved.

## Related Guides

Confirm the active task against [../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant companion
skill is consulted before you finish.

## Line Length Disclosure

Before presenting changes, scan the changed text files for lines longer than 100
characters (the Prettier `printWidth`). If any exist, report each `path:line` with its
measured length. Treat this as disclosure, not failure, unless an actual gate fails.

## Supporting Files

- [reference/quality-standards.md](reference/quality-standards.md): fix order,
  finding-to-suite mapping, protected gates, and the evidence to cite in review.
