# Gate Catalog

Each gate below lists its command, config file, what it enforces, the failures
you will actually hit, and the specialist skill that owns the fix. All commands
are Makefile targets run from the repository root. Reuse the targets; never call
the underlying binary with relaxed flags to bypass a gate.

## Format — Prettier

- **Command:** `make format`
- **Config:** `.prettierrc` (`printWidth: 100`, `singleQuote: true`, `semi: true`,
  `trailingComma: 'es5'`, `arrowParens: 'avoid'`, `tabWidth: 2`, `endOfLine: 'lf'`),
  scoped by `.prettierignore`.
- **Enforces:** consistent formatting across `js,jsx,ts,tsx,json,css,scss,md`.
  This is the only formatter — there is no `qlty fmt` and no jscpd duplication
  pass in this repo.
- **Common failures:** none as a gate; `make format` mutates files. Always run it
  before `make lint` so its output does not re-trigger a lint failure.
- **Owner:** [../../ci-workflow/SKILL.md](../../ci-workflow/SKILL.md) for run order.
- **Never:** add `prettier-ignore` to silence formatting; run `make format` to fix it.

## ESLint — `make lint-next`

- **Command:** `make lint-next`
- **Config:** `eslint.config.mjs` (flat config).
- **Enforces:** the project lint rules over `src`, `pages`, and tests.
- **Common failures:** unused symbols, import ordering, hook rules, accessibility
  lint, banned patterns.
- **Owner:** [../../frontend-component-development/SKILL.md](../../frontend-component-development/SKILL.md)
  for component/hook/form fixes; [../../code-organization/SKILL.md](../../code-organization/SKILL.md)
  when the noise is really a placement problem.
- **Never:** add `eslint-disable`; fix the rule violation.

## TypeScript — `make lint-tsc`

- **Command:** `make lint-tsc`
- **Config:** `tsconfig.json`.
- **Enforces:** the full type check (`tsc`, no emit).
- **Common failures:** unsafe `any`, missing props, narrowed-union mismatches,
  Apollo/`react-hook-form` generic mismatches.
- **Owner:** [../../frontend-component-development/SKILL.md](../../frontend-component-development/SKILL.md);
  [../../architecture/SKILL.md](../../architecture/SKILL.md) for data-flow typing.
- **Never:** add `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error`; type the code
  correctly.

## Markdown — `make lint-md`

- **Command:** `make lint-md`
- **Config:** `.markdownlint.yaml`; the ignore set lives in the Makefile
  `MD_LINT_ARGS` (it skips `CLAUDE.md`, `CHANGELOG.md`, `specs/**`, `_bmad/**`,
  `bmalph/**`, and generated report folders). Files under `.claude/skills/**` are
  a dot-directory and fall outside the `**/*.md` scan, but Prettier still formats
  them, so keep embedded code blocks Prettier-clean.
- **Enforces:** Markdown style rules (heading levels, line length, fenced-block
  spacing, allowed code-fence languages) on tracked Markdown.
- **Common failures:** MD013 line length, MD040 fence language, MD022/MD031/MD032
  blank-line spacing in `cursor-project-guide.md` and other scanned docs.
- **Owner:** [../../documentation-creation/SKILL.md](../../documentation-creation/SKILL.md);
  [../../documentation-sync/SKILL.md](../../documentation-sync/SKILL.md) when docs
  drifted from a code change.
- **Never:** add `markdownlint-disable`; rewrite the Markdown to comply.

## Architecture — `make lint-deps`

- **Command:** `make lint-deps` (dependency-cruiser over `src pages tests`).
- **Config:** `.dependency-cruiser.js`.
- **Enforces:** import boundaries — `features-import-via-public-api`,
  `no-cross-feature-imports`, `no-shared-ui-to-features`,
  `no-shared-layers-to-features`, `feature-allowed-folders`,
  `src-feature-name-kebab-case`, plus `no-circular` and `no-orphans`.
- **Common failures:** deep-importing another feature instead of its `index.ts`
  barrel, a shared layer reaching into a feature, a non-kebab-case feature
  directory, or a file in a folder a feature is not allowed to own.
- **Owner:** [../../architecture/SKILL.md](../../architecture/SKILL.md) and
  [../../code-organization/SKILL.md](../../code-organization/SKILL.md).
- **Never:** weaken a rule in `.dependency-cruiser.js`; move the code to the layer
  that is allowed to own it.

## Metrics — `make lint-metrics` (planned, issue #224)

This gate is introduced by issue #224 and is **not yet present on `main`**; the
budgets below become the complexity policy of record once #224 lands.

- **Command:** `make lint-metrics` (Mozilla rust-code-analysis, issue #224).
- **Config:** `config/metrics-policy.json`,
  validated against `config/metrics-policy.schema.json`; the same policy drives
  the CI workflow `.github/workflows/rust-code-analysis.yml`. Thresholds mirror
  the CRM sister repository's strict budgets and become the repo's complexity
  policy of record once #224 lands.
- **Enforces:** per-function and per-file budgets — cyclomatic, cognitive, ABC,
  NARGS, NEXITS, Halstead, maintainability index (MI), and file-size metrics.
  **Hard** metrics block (printed as `FAIL` rows); **review** metrics are reported
  but do not block.
- **Common failures:** a component mixing Apollo loading, `react-hook-form` state,
  and rendering; a hook with dense branching; an oversized `styles.ts`.
- **Owner:** [../../complexity-management/SKILL.md](../../complexity-management/SKILL.md).
- **Never:** lower a threshold or exclude a file; refactor (extract helper, lookup
  map, typed options object, split file, consolidate exits) to fit the budget.

## Test and runtime gates

These verify behavior rather than static rules. The root `agents.md` policy
governs which layers and scenario classes a change must cover.

- **`make test-unit-client`** — Jest + React Testing Library in jsdom
  (`TEST_ENV=client`): components, hooks, pure client logic. Specs in
  `src/test/testing-library/**/*.test.tsx` and `src/test/unit/**/*.test.ts`.
- **`make test-unit-server`** — Jest in node (`TEST_ENV=server`): Apollo resolvers
  and server-side logic. Specs in `src/test/apollo-server/**/*.test.ts`.
- **`make test-unit-all`** — both unit layers. Prefix `CI=1` to run without Docker.
- **`make test-e2e`** — Playwright (chromium/firefox/webkit) over Mockoon-mocked
  flows; specs in `src/test/e2e/**/*.spec.ts`.
- **`make test-visual`** — Playwright visual regression; snapshots in adjacent
  `*-snapshots/`. Regenerate intentionally with `make test-visual-update` and
  review the diff. Owner: [../../figma-design-check/SKILL.md](../../figma-design-check/SKILL.md).
- **`make test-mutation`** — Stryker mutation testing; guards assertion strength.
- **`make lighthouse-desktop` / `make lighthouse-mobile`** — Lighthouse CI budgets
  (`lighthouserc.desktop.js` / `lighthouserc.mobile.js`); Core Web Vitals,
  accessibility, best practices. Owner:
  [../../frontend-performance-accessibility/SKILL.md](../../frontend-performance-accessibility/SKILL.md).
- **`make test-load` / `make test-load-swagger`** — K6 load profiles.
- **`make test-memory-leak`** — memlab leak detection.

## What differs from the CRM sister repo

For parity context: CRM's `make format` also runs `qlty fmt`, and CRM exposes a
jscpd duplication gate (`make lint-dup`) and `make lint-eslint`. The website does
**not** configure `qlty` or jscpd, and its ESLint target is `make lint-next`. The
website adds a dependency-cruiser architecture gate (`make lint-deps`) that CRM
surfaces differently. Do not document or run CRM-only tools here.
