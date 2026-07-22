---
name: code-organization
description: >-
  Use when placing, moving, renaming, or splitting files in the website's
  src/features tree — deciding which feature or shared layer owns a component,
  hook, helper, api call, type, constant, or i18n string. Covers the
  bulletproof-react feature layout, feature-allowed-folders, the public-API
  index.ts barrel, ui-* shared components, kebab-case feature names, and the
  dependency-cruiser boundary rules surfaced by `make lint-deps`
  (features-import-via-public-api, no-cross-feature-imports, feature-allowed-
  folders, src-feature-name-kebab-case).
---

# Code Organization

## Core Rule

Place code by ownership first, then by type. Prefer the existing feature and
shared-layer structure over new top-level abstractions. The website follows
bulletproof-react: domain code lives in `src/features/<feature>/`, and every
feature exposes a single public surface through its `index.ts` barrel.

## Frontend Structure

```text
src/
  features/
    landing/             # feature dir name: lowercase kebab-case (enforced)
      api/               # GraphQL operations + Apollo Client data access
      assets/            # feature-scoped img/svg
      components/        # feature UI
      constants/
      helpers/           # feature-scoped pure helpers
      hooks/             # use* hooks
      i18n/              # en.json, uk.json (react-i18next)
      routes/            # optional; pages/ does route composition
      types/
      utils/
      index.ts           # PUBLIC API barrel — the only import entrypoint
  components/            # shared UI primitives (ui-* prefix)
  hooks/  lib/  providers/  shared/  stores/  utils/  config/  types/  routes/
  assets/
  test/                  # specs grouped by type (see Test Placement)
pages/                   # Next.js pages router — feature composition layer
```

Use `src/features/<feature>/` for domain-owned workflows. Use
`src/components/ui-*` for reusable, feature-agnostic UI building blocks.

## Placement Rules

- Feature UI stays with its feature unless it is genuinely shared by more than
  one feature without feature-specific props, copy, or state.
- Shared components live in `src/components/` with the `ui-*` prefix and use
  MUI 9 + Emotion patterns. They must not depend on any feature
  (`no-shared-ui-to-features`).
- Data access lives in `features/<feature>/api/` (GraphQL documents + Apollo
  Client 4). There is no shared HTTP-client layer to call directly; server
  state flows through the Apollo cache.
- Outside code imports a feature only through its `index.ts` barrel, never a
  deep path (`features-import-via-public-api`, plus ESLint
  `no-restricted-imports` on `@/features/*/*`).
- A feature must not import a sibling feature; share through `src/components`,
  `src/shared`, `src/lib`, `src/hooks`, or `src/utils`
  (`no-cross-feature-imports`).
- Foundational layers (`shared`, `hooks`, `utils`, `lib`, `providers`, `types`,
  `config`, `routes`, `stores`) must not depend on a feature
  (`no-shared-layers-to-features`).
- Form state uses react-hook-form; locale state uses i18next. There is no
  Redux, Zustand, or DI container — do not add a feature-level `store/`.
- Translation files live in feature `i18n/en.json` and `i18n/uk.json`; assert
  localized strings via the i18next `t()` function, not hardcoded English.
- Tests live under `src/test/**` grouped by type (see Test Placement).
- Use the `@/` alias (`@/*` → `src/*`), plus `@landing/*` and `@swagger/*`
  where defined, instead of deep relative paths across folders.

## Naming Rules

Architecture and naming boundaries are enforced by `dependency-cruiser`
(see `.dependency-cruiser.js`). Violations fail `make lint-deps` and CI.

- Feature directory names under `src/features/` are lowercase kebab-case —
  `landing`, `user-onboarding`, not `Landing` or `userOnboarding`
  (`src-feature-name-kebab-case`). This is the one hard naming gate, and the
  current features (`landing`, `swagger`, `registration`, `documentation`,
  `example`) all comply.
- A feature root may contain ONLY the `index.ts` barrel plus these folders:
  `api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`,
  `routes`, `types`, `utils` (`feature-allowed-folders`). Any other folder or
  stray root file fails the gate. Data access is `api/`, not `repositories/`;
  there is no feature-level `store/`.
- Shared UI components use the `ui-*` prefix in `src/components/`
  (e.g. `src/components/ui-button`). This is the standard direction for new and
  touched code. `dependency-cruiser` deliberately omits a global
  uppercase-paths gate, so this is a convention, not a hard fail; some existing
  shared and feature component directories are still PascalCase
  (`UiButton`, `AboutUs`, `Header`) from before the kebab-case migration —
  prefer the `ui-*` kebab-case target when you add or move code.
- Component identifiers (the exported symbol) stay PascalCase
  (`export default function UiButton`), exported through the feature barrel
  (e.g. `LandingComponent`, `Swagger`).
- Hook identifiers are `useSomething`; hook files match the symbol
  (`useFormReset.ts`).
- Helpers get specific names describing the transformation or decision they
  perform (`normalizeLink.ts`, `handleApolloError.ts`) — never `helper`,
  `misc`, `common`, `manager`, or a catch-all `utils.ts`.
- Test files match their subject and live in the type folder for the layer
  they exercise (see Test Placement).

## Test Placement

Specs live under `src/test/**`, grouped by test TYPE rather than mirroring the
feature path. Name each spec after its subject so ownership stays obvious.

- `src/test/testing-library/**/*.test.tsx` and `src/test/unit/**/*.test.ts` —
  client unit (Jest jsdom, `TEST_ENV=client`).
- `src/test/apollo-server/**/*.test.ts` — server unit (Jest node,
  `TEST_ENV=server`).
- `src/test/e2e/**/*.spec.ts` — Playwright + Mockoon flows.
- `src/test/visual/**/*.spec.ts` — Playwright visual regression (snapshots in
  adjacent `*-snapshots/`).
- `src/test/load/` (K6) and `src/test/memory-leak/` (memlab).

A helper at `src/features/landing/helpers/normalizeLink.ts` is covered by
`src/test/unit/normalizeLink.test.ts`; a component `AboutUs` by
`src/test/testing-library/AboutUs.test.tsx`.

## Avoid

- New shared folders without existing demand from more than one feature.
- Deep imports that bypass a feature's public `index.ts` barrel.
- Cross-feature imports; route shared code through a shared layer instead.
- Business strings hardcoded in JSX instead of i18next `t()`.
- Components that mix data fetching, layout, validation, and presentation when
  a hook or child component would make the boundary clearer.

## Validate

Run before claiming the move is done:

```bash
make format     # Prettier — run first
make lint-deps  # dependency-cruiser boundary + naming rules
make lint       # full gate: ESLint, TypeScript, markdownlint, lint-deps
```

`make format` normalizes formatting (Prettier `printWidth` 100), so there is no
manual line-length ritual — let the gate report any remaining issue.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) (when present) so every
relevant skill is consulted, and against the repository contract in
[AGENTS.md](../../../AGENTS.md).

## Supporting Files

- [examples/organization-fixes.md](examples/organization-fixes.md): concrete
  placement, barrel-import, and naming fixes.
- [reference/troubleshooting.md](reference/troubleshooting.md): guidance for
  ambiguous ownership, imports, folder names, and test placement.
