# Code Review Quality Standards

Detail behind the `code-review` SKILL: the order to fix comments in, how each finding
category maps to a verification suite, and the gates that must not be weakened to clear
a review. All commands are website Makefile targets run from the repo root.

## Review Comment Fix Order

1. Reproduce reported bugs or failing tests first, with a test that fails before the fix.
2. Apply exact "committable suggestion" diffs only after reading the nearby code.
3. Run the narrowest relevant suite (see the mapping below).
4. Run `make format` before `make lint` so Prettier churn never fails the lint gate.
5. Re-run `make pr-comments` to confirm nothing regressed or was missed.

## Retrieving Comments

`make pr-comments` wraps `scripts/get-pr-comments.sh`. It needs an authenticated `gh`
(`gh auth status`) and `jq`.

- No `PR` argument auto-detects the PR for the current branch.
- `FORMAT=text` (default) is human-readable; `FORMAT=json` is for tooling; and
  `FORMAT=markdown` produces a paste-ready summary.
- `PR` and `FORMAT` may be combined, e.g. `make pr-comments PR=304 FORMAT=markdown`.

## Finding Category To Verification Suite

Categorize each comment, route it to the companion skill that owns the concern, then run
the suite that actually exercises the change.

| Category               | Route / action                            | Verify with                  |
| ---------------------- | ----------------------------------------- | ---------------------------- |
| Committable suggestion | Apply if correct for nearby code          | `CI=1 make test-unit-client` |
| Bug — client behavior  | Failing test in jsdom, then fix           | `CI=1 make test-unit-client` |
| Bug — Apollo resolver  | Failing test in node env, then fix        | `CI=1 make test-unit-server` |
| Bug — user flow        | Reproduce end to end (Mockoon)            | `make test-e2e`              |
| UI or styling change   | Inspect the snapshot diff                 | `make test-visual`           |
| Architecture concern   | `code-organization` skill                 | `make lint-deps`             |
| Complexity concern     | `complexity-management` skill             | qlty `[smells]` bot          |
| Test gap               | Add cases per `agents.md` coverage policy | the touched suite            |
| Question               | Clarify the code or answer in the thread  | `make lint`                  |

Architecture findings (cross-feature imports, importing past a feature's `index.ts`
barrel, shared layers reaching into `src/features`) are encoded as real
`.dependency-cruiser.js` rules — for example `no-cross-feature-imports`,
`features-import-via-public-api`, `no-shared-layers-to-features`, and
`src-feature-name-kebab-case`. Re-run `make lint-deps` after the fix.

Complexity findings come from the qlty `[smells]` analyzer in `.qlty/qlty.toml`, which
runs in `comment` mode and posts on the PR. Resolve them by extracting helpers or
simplifying control flow, not by suppressing the bot.

Test-gap findings follow the mandatory coverage policy in `agents.md`: cover positive,
negative, and boundary/edge classes at the smallest meaningful layer, assert localized
`t()` output and user-facing queries, and document any genuinely inapplicable class with
a concrete `Not applicable: <reason>` note.

## Do Not Trade Quality For Silence

- Do not lower thresholds in `eslint.config.mjs`, `tsconfig.json`,
  `.dependency-cruiser.js`, `.markdownlint.yaml`, or the `.qlty/qlty.toml` smell limits.
- Do not add `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`,
  `prettier-ignore`, or `markdownlint-disable`; fix the underlying code or type.
- Do not widen a type to `any` or weaken generics to clear a single tsc error.
- Do not run `make test-visual-update` to mask an unintended visual change; update
  baselines only for a deliberate, reviewed UI change after inspecting the diff.

## Evidence To Mention In Review

Cite concrete checks you actually ran, narrowest first:

```bash
make format
CI=1 make test-unit-client
make test-e2e
make lint
```

If a check could not run (for example an E2E suite that needs the prod compose stack),
say so explicitly and report the narrowest check that did pass instead.
