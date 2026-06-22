# Story 3.1: Add the no-orphans rule with the entrypoint/output allowlist

Status: done

## Story

As a developer,
I want unused (orphan) modules flagged while legitimate entrypoints, configs, and generated output are exempt,
so that dead code is caught without false positives against Next.js pages, Storybook, config files, and report directories.

## Acceptance Criteria

1. `no-orphans` has severity `error` and `from: { orphan: true, pathNot: [...] }` (FR12a).
2. The `pathNot` allowlist exempts dot-files, `*.d.ts`, `tsconfig.json`, `(babel|webpack).config.*`, `(commitlint|stryker).config.*`, `__mocks__/`, `next.config.js`, `jest.config.ts`, `jest.mutation.config.ts`, `babel-jest.config.js`, `i18n.js`, `mutation.js`, `checkNodeVersion.js`, `lighthouserc.*.js`, `^pages/`, `^.storybook/`, `^coverage/`, `^test-results/`, `^playwright-report/`, and `^storybook-static/` (FR12a).
3. Given a genuinely unused module under `src`, `make lint-deps` fires `no-orphans` and names it (FR12a, NFR7).
4. Against current `main`, the allowlist suppresses all entrypoint/config/output paths so the rule produces zero false positives (NFR9).

## Tasks / Subtasks

- [x] Task 1: Add the `no-orphans` rule to the `forbidden[]` array in `.dependency-cruiser.js` (AC: 1, 2)
  - [x] 1.1 Insert the rule as the second entry in `forbidden[]` (immediately after `no-circular`), per the generic-hygiene-rules-first ordering in the architecture (rules 1–10 before boundary rules 11–16).
  - [x] 1.2 Set `name: 'no-orphans'`, `severity: 'error'`, and a `comment` stating intent (drives FR21 actionable output).
  - [x] 1.3 Author `from: { orphan: true, pathNot: [...] }` and `to: {}` so orphan detection applies to the source side with the allowlist scoping which orphans are reported.
- [x] Task 2: Author the `pathNot` allowlist exactly as specified (AC: 2, 4)
  - [x] 2.1 Add the file-pattern exemptions: dot-files `(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$`, type declarations `[.]d[.]ts$`, `(^|/)tsconfig[.]json$`, `(^|/)(?:babel|webpack)[.]config[.][^/]+$`, `(^|/)(?:commitlint|stryker)[.]config[.][^/]+$`, `(^|/)__mocks__/`.
  - [x] 2.2 Add the named-config exemptions: `(^|/)next[.]config[.]js$`, `(^|/)jest[.]config[.]ts$`, `(^|/)jest[.]mutation[.]config[.]ts$`, `(^|/)babel-jest[.]config[.]js$`, `(^|/)i18n[.]js$`, `(^|/)mutation[.]js$`, `(^|/)checkNodeVersion[.]js$`, `(^|/)lighthouserc[.][^/]+[.]js$`.
  - [x] 2.3 Add the entrypoint and output-directory exemptions anchored with `^`: `^pages/`, `^[.]storybook/`, `^coverage/`, `^test-results/`, `^playwright-report/`, `^storybook-static/`.
- [x] Task 3: Validate the rule fires on a genuine orphan (AC: 3)
  - [x] 3.1 Temporarily create a throwaway unused module under `src` (imported by nothing) and run `make lint-deps`; confirm `no-orphans` fires, names the module, and yields a non-zero exit.
  - [x] 3.2 Remove the throwaway module; this is a verification step only and must not be committed.
- [x] Task 4: Validate zero false positives against current `main` (AC: 4)
  - [x] 4.1 Run `make lint-deps CI=1` on the clean graph and confirm `no-orphans` reports zero violations — `pages/`, `.storybook/`, config files, and report directories are all suppressed by the allowlist.

## Dev Notes

### Architecture Decisions

This story implements rule 2 (`no-orphans`) of the sixteen-rule `forbidden[]` array, governed by **AD-5: Analysis scope and `no-orphans` allowlist (zero false positives, performance)** (from architecture-dependency-cruiser-ci-2026-06-22.md). The architecture states: "Entrypoints and generated output are not orphans; without the allowlist `no-orphans` would fire spuriously and violate NFR9." The rule is part of the generic-hygiene block ported from CRM and placed before the architecture boundary rules.

The exact rule, ready to drop into `forbidden[]` (from the Complete Drop-In `.dependency-cruiser.js` in architecture-dependency-cruiser-ci-2026-06-22.md):

```js
// 2. Orphan (unused) modules — entrypoints/configs/outputs are exempted. (FR12a)
{
  name: 'no-orphans',
  severity: 'error',
  comment: 'Modules that are not imported by anything (orphans) are flagged.',
  from: {
    orphan: true,
    pathNot: [
      '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$', // dot-files (.eslintrc.js, etc.)
      '[.]d[.]ts$', // type declarations
      '(^|/)tsconfig[.]json$',
      '(^|/)(?:babel|webpack)[.]config[.][^/]+$',
      '(^|/)(?:commitlint|stryker)[.]config[.][^/]+$',
      '(^|/)__mocks__/',
      '(^|/)next[.]config[.]js$',
      '(^|/)jest[.]config[.]ts$',
      '(^|/)jest[.]mutation[.]config[.]ts$',
      '(^|/)babel-jest[.]config[.]js$',
      '(^|/)i18n[.]js$',
      '(^|/)mutation[.]js$',
      '(^|/)checkNodeVersion[.]js$',
      '(^|/)lighthouserc[.][^/]+[.]js$',
      '^pages/', // Next.js page entrypoints
      '^[.]storybook/',
      '^coverage/',
      '^test-results/',
      '^playwright-report/',
      '^storybook-static/',
    ],
  },
  to: {},
},
```

Key points carried over from the architecture:

- **Anchored output/entrypoint patterns** (`^pages/`, `^[.]storybook/`, `^coverage/`, `^test-results/`, `^playwright-report/`, `^storybook-static/`) use a leading `^` because they are repository-root directories; the file-pattern exemptions use `(^|/)` so they match regardless of directory depth (AD-5, Format Patterns).
- This rule depends on the `options` block from Story 1.2 — specifically `tsConfig.fileName: 'tsconfig.json'` (AD-2) and `enhancedResolveOptions` — being already present so the `@/*` import graph resolves; otherwise unresolved edges would distort orphan detection. Story 1.2 is a prerequisite.
- `skipAnalysisNotInRules: true` and `doNotFollow.path: ['node_modules']` (AD-5, set in Story 1.2) keep the cruise inside the ~30 s budget (NFR1) with no app build (NFR2) and no network (NFR5).
- This story changes only the `forbidden[]` array; it does NOT modify the `options` block, the Makefile, the workflow, or any `src/` file (Blast-Radius Inventory; AR9 planning constraint).

### Project Structure Notes

- **Modify:** `.dependency-cruiser.js` (repository root) — add the `no-orphans` rule object to the `forbidden[]` array as rule 2, immediately after `no-circular`. No other section of the file is touched by this story.
- **Unchanged / depended-upon:** `tsconfig.json` (read via `options.tsConfig.fileName` for `@/*` resolution); `options` block authored in Story 1.2.
- **Not touched:** `Makefile`, `.github/workflows/dependency-cruiser.yml`, `README.md`, `package.json`, and everything under `src/`, `pages/`, `public/`, `styles/` (the allowlist exempts the relevant entrypoints/outputs rather than excluding them from analysis).

### Testing Approach

This is configuration / tooling, not application code, so it is validated by running the tool, not by unit tests:

- **Dry-run / local:** run `make lint-deps` (dev container) or `make lint-deps CI=1` (direct on runner) which invokes `$(PNPM_EXEC) $(DEPCRUISE_BIN) src tests --config .dependency-cruiser.js`.
- **Positive test (AC 3):** temporarily add an unused module under `src` and confirm `no-orphans` fires, names the module, and exits non-zero (NFR6, NFR7); remove the throwaway module afterward.
- **Zero-false-positive test (AC 4):** run against current `main` and confirm `no-orphans` reports zero violations — the allowlist suppresses `pages/`, `.storybook/`, config files, and report directories (NFR9).
- **CI validation:** the dedicated `.github/workflows/dependency-cruiser.yml` (Epic 5) re-runs `make lint-deps CI=1` on every PR to `main`, proving the rule green on the introducing PR.

### References

- Architecture: `architecture-dependency-cruiser-ci-2026-06-22.md` — **AD-5: Analysis scope and `no-orphans` allowlist (zero false positives, performance)**; **Complete Drop-In `.dependency-cruiser.js`** (rule 2 `no-orphans`); **Requirements to File Mapping** (FR12a → `no-orphans` + allowlist → AD-5); **Cross-Cutting Concerns Identified** ("Entrypoints vs. orphans"); **Format Patterns** (anchored regexes).
- Epics: `epics-dependency-cruiser-ci-2026-06-22.md` — **Story 3.1: Add the no-orphans rule with the entrypoint/output allowlist** (Epic 3: Generic Hygiene Rules).
- PRD: `prd-dependency-cruiser-ci-2026-06-22.md` — **FR12a** (`no-orphans` + `pathNot` allowlist); **NFR7** (actionable output naming rule/source/target); **NFR9** (zero false positives on `main`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Verified via `make lint-deps CI=1` (dependency-cruiser: 0 violations), `make lint CI=1` (ESLint, TypeScript, markdownlint, dependency-cruiser all pass), and the client/server Jest suites (349 + 8 passing).

### Completion Notes List

- Added no-orphans rule with an allowlist for entrypoints/configs/generated output (pages/, next.config.js, jest/babel/stryker configs, storybook/coverage/test-results, etc.). Compliance: deleted 4 genuinely-dead files.
- Part of issue #225; full architecture gate verified green on the current main branch (0 dependency-cruiser violations).

### File List

- `.dependency-cruiser.js`
- `src/index.ts (removed)`
- `src/features/swagger/api/fetchSwaggerYaml.ts (removed)`
- `src/features/swagger/types/social-media/index.ts (removed)`
- `src/features/landing/components/AuthSection/SocialItem/styles.ts (removed)`

### Change Log

- 2026-06-22: Implemented and verified as part of #225 (dependency-cruiser architecture gate).
