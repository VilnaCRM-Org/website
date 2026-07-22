# CI failure recovery

Per-gate recovery for the website `make lint` / test surface. Always re-run
`make format` first when anything looks like a formatting problem, then the specific
gate. Fix the cause; never silence the gate.

## Prettier (`make format`)

`make format` runs Prettier over `**/*.{js,jsx,ts,tsx,json,css,scss,md}`. It rewrites
files in place, so a "formatting" failure in CI means `make format` was not run (or its
output was not committed).

- Re-run `make format`, then `git status --short` to see what it rewrote.
- Commit the rewrites; do not hand-tune spacing, quotes, or line wrapping.
- Markdown under `.claude/skills/**` is Prettier-formatted too (it is only exempt from
  markdownlint, not Prettier), so embedded code fences must already be Prettier-clean.

## ESLint (`make lint-next`)

- Read the rule id in the output and fix the root cause.
- Never add `eslint-disable`, `eslint-disable-next-line`, or per-file overrides to pass.
- If the rule looks wrong for the whole repo, raise it as a separate config change with
  review — not inline in a feature PR.

## TypeScript (`make lint-tsc`)

- `make lint-tsc` runs `tsc` against the project config; fix the type contract at the
  source of the error.
- Never reach for `@ts-ignore`, `@ts-nocheck`, or an `as any` escape hatch to clear it.

## markdownlint (`make lint-md`)

- Applies to scanned `**/*.md` (ignores include `CLAUDE.md`, `CHANGELOG.md`, `specs/**`,
  `_bmad/**`, and report output). `.claude/skills/**` is not scanned because it is a
  dot-directory.
- Keep ATX headings with blank lines above and below, fenced code blocks fenced with a
  language, single-`-` unordered markers, `1.` ordered markers, and lines within the
  configured width.
- `cursor-project-guide.md` is top-level and scanned: there, code fences may only use the
  `bash` language and lines stay within the line-length rule.

## dependency-cruiser (`make lint-deps`)

`make lint-deps` validates `src pages tests` against `.dependency-cruiser.js`. Common
boundary failures and their fixes:

- `features-import-via-public-api` / `no-cross-feature-imports` — import another feature
  only through its `src/features/<feature>/index.ts` barrel, never a deep internal path.
- `no-shared-ui-to-features` / `no-shared-layers-to-features` — shared layers
  (`src/components`, `src/hooks`, `src/lib`, `src/utils`, ...) must not import from
  `src/features/*`; invert the dependency or lift the shared piece.
- `no-circular` / `no-orphans` — break the cycle or wire the orphan into a barrel.
- `feature-allowed-folders` / `src-feature-name-kebab-case` — keep feature subfolders to
  the allowed set and name every directory and file in kebab-case.

Fix the import graph; do not relax a rule in `.dependency-cruiser.js`.

## Jest unit suites

- Reproduce the single failing spec before editing code, e.g.
  `CI=1 TEST_ENV=client bun x jest src/test/unit/email-validation.test.ts`.
- Client specs run in jsdom (`TEST_ENV=client`); Apollo/server specs run in node
  (`TEST_ENV=server`, under `src/test/apollo-server`).
- Assert user-facing behavior and localized `t()` output, not implementation details —
  fix the behavior, not the assertion.

## Playwright visual (`make test-visual`)

- First decide whether the pixel diff reflects a real, intended UI change. If yes, refresh
  the baselines with `make test-visual-update` (runs in the Docker Playwright container)
  and review the snapshot diff before committing.
- If the diff is pure environment drift — for example a Playwright or browser bump nudges
  the webkit baselines by a couple of pixels with no UI change — regenerate the affected
  baselines in the Docker Playwright container (webkit, single worker) rather than masking
  it. Never add `maxDiffPixels` or a per-test threshold to hide a diff.

## Playwright e2e (`make test-e2e`)

- E2E runs against the Docker prod stack with the Mockoon API mock. A failure is usually
  a real flow regression or a stale Mockoon fixture — reproduce locally before assuming
  flake.

## Stryker mutation (`make test-mutation`)

- Surviving mutants mean a behavior is unasserted. Add or strengthen an assertion that
  fails when the mutant changes behavior.
- Do not raise the allowed-survivor count or lower the mutation-score threshold to pass.

## Threshold protection (all gates)

Coverage thresholds, mutation score, dependency-cruiser rules, ESLint/tsc strictness,
markdownlint rules, visual diff tolerance, and any complexity/metrics budget are the
contract. Lowering or disabling any of them to get green is a regression in disguise.
When a limit genuinely does not apply, record a concrete `Not applicable: <reason>` per
agents.md — never a silent suppression.
