# dependency-cruiser rules reference

The source of truth is `.dependency-cruiser.js` at the repo root. `make lint-deps`
runs `depcruise src pages tests --config .dependency-cruiser.js`. This file
explains each rule, its severity, what it forbids, and the practical fix. When a
rule fires, fix the code — never weaken the config.

The website config was adapted from the CRM sister repo and rewritten for the
**feature-based** layout: there is **no `src/modules` layer**, so CRM's
module-isolation, repository-boundary, and DI-containment rules do **not** exist
here. CRM's global `no-uppercase-paths` is also deliberately omitted, because
shared/feature component directories are PascalCase by convention; lowercase
enforcement is scoped to feature directory names only.

## Architecture boundary rules (severity: error)

### features-import-via-public-api

Forbids importing a feature's internal files from anywhere under `src/`. Outside
code must go through the feature's `index` barrel.

- **from:** `src/` — **except** files already inside `src/features/<feature>/`
  (a feature reads its own internals) and `src/test/` (tests may import
  internals).
- **to:** `src/features/<feature>/` anything that is not the `index` barrel.
- **Why it matters:** the barrel is the feature's contract; deep imports couple
  callers to internal structure and defeat refactoring.
- **Fix:** export the symbol from `src/features/<feature>/index.ts` and import the
  barrel. `pages/` is outside `src/` and is the composition root, so it may import
  internals to wire routes (e.g. the dynamically imported landing Header in
  `pages/_app.tsx`).
- **ESLint complement:** `no-restricted-imports` bans the `@/features/*/*` pattern
  at lint time, so most deep imports fail in `make lint-next` too.

### no-cross-feature-imports

Forbids one feature importing another feature at all.

- **from:** `src/features/<A>/` — **to:** `src/features/<B>/` (any other feature).
- **Why:** features are independent slices; cross-imports create hidden coupling
  and cycles.
- **Fix:** lift the shared code to a foundational layer (`src/hooks`, `src/lib`,
  `src/utils`, `src/shared`, ...) or to `src/components` if it is shared UI, then
  import that from both features.

### no-shared-ui-to-features

Forbids the shared UI library (`src/components`) from depending on any feature.

- **from:** `src/components/` — **to:** `src/features/`.
- **Why:** shared primitives must stay feature-agnostic and reusable everywhere.
- **Fix:** invert the dependency — accept the feature-specific piece as a prop or
  child instead of importing it. `pages/_app.tsx` does this for the landing
  Header: the shared `Layout` stays clean while the page composes the feature in.

### no-shared-layers-to-features

Forbids foundational layers from depending on features.

- **from:** `src/shared`, `src/hooks`, `src/utils`, `src/lib`, `src/providers`,
  `src/types`, `src/config`, `src/routes`, `src/stores` — **to:** `src/features/`.
- **Why:** these layers sit beneath features in the dependency graph; depending
  upward creates cycles and breaks reuse.
- **Fix:** move feature-specific logic into the feature, or pass the data in.

### feature-allowed-folders

A feature root may contain only its `index` barrel and these folders: `api`,
`assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`,
`types`, `utils`.

- **Flags:** any other file or directory placed directly at a feature root (for
  example a stray `services/` or `validations/` folder, or a loose `.ts` file).
- **Fix:** put the code in an approved folder. Apollo client and gql documents go
  in `api/`; pure transforms and error mappers go in `helpers/`; form validation
  schemas live nested under a component (e.g.
  `components/AuthSection/Validations/`) rather than at the feature root.

### src-feature-name-kebab-case

Feature directory names must be lowercase kebab-case.

- **Flags:** `src/features/<name>/` where `<name>` is not `[a-z0-9-]+`
  (e.g. `UserOnboarding`, `user_onboarding`).
- **Fix:** rename the directory to kebab-case (`user-onboarding`).
- **Note:** this is the scoped, stakeholder-mandated replacement for CRM's global
  `no-uppercase-paths`. It governs **feature directory names only** — not files
  and not shared component directories (which remain PascalCase by convention).

## Generic hygiene rules

These ported, stack-agnostic rules run on the same `make lint-deps` pass.

### Errors

- **no-circular** — no circular dependencies anywhere. Closes the gap left by the
  unconfigured ESLint `import/no-cycle`. Fix by extracting the shared piece both
  sides need into a third module.
- **no-orphans** — modules imported by nothing are flagged. Entrypoints and config
  are exempt (`pages/`, `.storybook/`, `next.config.js`, `jest.config.ts`,
  `__mocks__/`, dot-files, `*.d.ts`, build/report output, etc.). A new orphan is
  usually dead code or something you forgot to wire through a barrel/page.
- **no-non-package-json** — no importing packages absent from `package.json`
  (`npm-no-pkg`, `npm-unknown`). Add the dependency or fix the import.
- **not-to-unresolvable** — no importing modules that cannot be resolved
  (`http(s)://` excepted). Usually a typo or a missing path alias.
- **not-to-test** — production code (anything not under `src/test` or `tests`) must
  not import from those test folders.
- **not-to-spec** — nothing may import a `*.spec.*` or `*.test.*` file.
- **not-to-dev-dep** — runtime code under `src` must not import `devDependencies`.
  Test code (`*.spec`/`*.test`, `src/test/`) and `type-only` imports are exempt, so
  tests can use `@playwright/test`, `@testing-library/*`, faker, etc.

### Warnings

- **no-deprecated-core** — do not depend on deprecated Node core modules
  (`punycode`, `domain`, `sys`, ...).
- **not-to-deprecated** — do not depend on npm packages flagged deprecated.
- **no-duplicate-dep-types** — a dependency should be declared under exactly one
  dependency type (`type-only` excepted).

## Resolution and scope notes

- The cruiser resolves the `@/*` alias to `./src/*` via `tsconfig.json`
  (`@/features/landing` -> `src/features/landing/index.ts`).
- `tsPreCompilationDeps` and `combinedDependencies` are on, so type-only imports
  and both `dependencies` + `devDependencies` are considered.
- `k6` and `k6/http` are registered as built-in modules so load tests under
  `src/test/load/` resolve cleanly.
- The run covers `src`, `pages`, and `tests`; `node_modules` is not followed.

## What is NOT enforced (do not assume it is)

- No rule enforces the internal Component to Hook to Data ordering inside a
  feature — a component importing `api/` directly will pass `make lint-deps`. The
  layering is a code-review convention, not a graph rule.
- No repository-boundary, module-isolation, DI-containment, or global
  uppercase-path rules exist here (those are CRM-only, tied to `src/modules` and a
  DI container the website does not have).
