---
name: architecture
description: >-
  Use when placing a new file, building or extending a feature, wiring an Apollo
  data flow, or fixing a dependency-cruiser / make lint-deps error in the
  VilnaCRM website. Covers the feature-based bulletproof-react layout under
  src/features, the Component to Hook to Apollo data flow, and the import
  boundaries (public-API barrel, no cross-feature imports, allowed feature
  folders, kebab-case feature names) enforced by make lint-deps. Trigger terms:
  dependency-cruiser, lint-deps, features-import-via-public-api,
  no-cross-feature-imports, feature placement, public API barrel, Apollo Client,
  useMutation, where does this file go.
---

# Architecture

The VilnaCRM **website** is a Next.js 16 (pages router) marketing/landing app on
React 19 + TypeScript 6, MUI 9 + Emotion, Apollo Client 4 (against a local Apollo
Server 5 GraphQL mock), react-hook-form, and i18next. The structure is adapted
from **bulletproof-react**: code lives in self-contained **features** under
`src/features/<feature>/`, with foundational shared layers (`src/components`,
`src/hooks`, `src/lib`, `src/providers`, `src/shared`, `src/utils`, `src/config`,
`src/types`, `src/stores`, `src/routes`, `src/assets`) underneath them.

This skill captures three things: how a feature is **layered** (Component to Hook
to Apollo/data to API), where a new file **belongs**, and which import boundaries
are enforced as `dependency-cruiser` errors surfaced by `make lint-deps`. There is
**no** `src/modules` layer, no Redux/Zustand store, and no DI container — the
website is flatter than the CRM sister repo.

## The layered flow (internalize this)

Every feature follows the same top-to-bottom data flow. The landing sign-up form
is the worked example (see `examples/layered-flow.md`):

```text
pages/  (Next.js route + composition root; mounts <ApolloProvider>)
  -> Feature public barrel   src/features/<feature>/index.ts
       -> Component          components/*.tsx     presentation + local UI state
            -> Hook          hooks/use-*.ts       react-hook-form, Apollo useMutation/useQuery
                 -> Data      api/graphql/apollo.ts (ApolloClient) + api/service/*.ts (gql + types)
                      -> GraphQL API   NEXT_PUBLIC_GRAPHQL_API_URL  (Apollo Server mock)
  helpers/*.ts  pure transforms + error mappers (e.g. handleApolloError)
```

Read the layers top to bottom:

1. **Pages** (`pages/*.tsx`) — the Next.js routing root and composition layer. It
   wires the `<ApolloProvider>` (client from `src/features/landing/api/graphql/`)
   and renders a feature through its public barrel, e.g. `pages/index.tsx` renders
   `<LandingComponent />` from `@/features/landing`. `pages/` lives **outside**
   `src/` and is intentionally exempt from the public-API gate, so it is the one
   place allowed to reach feature internals when composing routes.
2. **Components** (`features/<feature>/components/`) — presentation and local UI
   state. They call hooks and Apollo hooks, render children, and map errors with a
   helper; they do not own global state.
3. **Hooks** (`features/<feature>/hooks/use-*.ts`) — reusable UI logic and effects
   (form reset, data fetching, Apollo `useMutation` / `useQuery` wiring). This is
   where data access belongs when it is shared across components.
4. **Data / API** (`features/<feature>/api/`) — `api/graphql/apollo.ts` builds the
   `ApolloClient` (HttpLink to `NEXT_PUBLIC_GRAPHQL_API_URL`, `InMemoryCache`);
   `api/service/*.ts` defines `gql` documents as `TypedDocumentNode`s with their
   input/payload types. This is the website analog of CRM's repository layer.
5. **GraphQL API** — the local Apollo Server mock the client talks to.

Important: this layering is a **convention reinforced in code review**, not a
machine-enforced order. `dependency-cruiser` enforces **feature-level boundaries**
(below), not the internal Component to Hook to Data ordering. Keep the discipline
even though the linter will not catch a component that skips its hook.

## Feature anatomy and the public API

A feature root may contain only its `index.ts` barrel plus these folders
(`feature-allowed-folders`): `api`, `assets`, `components`, `constants`,
`helpers`, `hooks`, `i18n`, `routes`, `types`, `utils`. Anything else at the
feature root fails `make lint-deps`. (Form validation schemas live nested under a
component, e.g. `components/AuthSection/Validations/`, or in `helpers/` — there is
no `validations/` folder at the feature root.)

Outside code imports a feature **only through its barrel**:

```ts
import { LandingComponent } from '@/features/landing';
```

Reaching into internals (`@/features/landing/components/...`) from another part of
`src/` fails both ESLint `no-restricted-imports` (`@/features/*/*`) and the
`features-import-via-public-api` cruiser rule.

**Feature catalog:** `landing` (fully built — `api`, `assets`, `components`,
`constants`, `helpers`, `hooks`, `i18n`, `types`), `swagger` (`assets`,
`components`, `hooks`, `i18n`), and the scaffolds `registration`, `documentation`,
and `example` (currently `i18n` only). New product surfaces become new
`src/features/<kebab-name>/` directories.

## Boundary rules (dependency-cruiser, run by make lint-deps)

`make lint-deps` runs `depcruise src pages tests`. The architecture rules — all
severity `error` — are:

| Rule                             | Forbids                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `features-import-via-public-api` | importing a feature's internals from `src/` (use the `index` barrel)                         |
| `no-cross-feature-imports`       | one feature importing another feature at all (use a shared layer)                            |
| `no-shared-ui-to-features`       | `src/components` (shared UI) depending on any feature                                        |
| `no-shared-layers-to-features`   | `src/{shared,hooks,utils,lib,providers,types,config,routes,stores}` depending on any feature |
| `feature-allowed-folders`        | stray files/folders at a feature root (only the barrel + allowed folders)                    |
| `src-feature-name-kebab-case`    | a `src/features/<name>` directory whose name is not lowercase kebab-case                     |

Alongside these run the generic-hygiene rules (`no-circular`, `no-orphans`,
`no-non-package-json`, `not-to-unresolvable`, `not-to-test`, `not-to-spec`,
`not-to-dev-dep`, plus the `warn`-level `no-deprecated-core`, `not-to-deprecated`,
`no-duplicate-dep-types`). Full per-rule detail, severities, and exceptions are in
`reference/dependency-cruiser-rules.md`.

When a rule fires, the fix is almost always to **add or use the missing layer**
(a barrel re-export, a shared hook, a moved helper) — never to weaken
`.dependency-cruiser.js`.

## Where does this file go? (placement decision tree)

```text
Start: I am adding new code.

1. Is it shared UI used across features, with no feature knowledge?
     yes -> src/components/<UiComponent>  (must not import any feature)
     no  -> 2

2. Does it belong to exactly one feature?
     yes -> 3
     no  -> 4

3. Within that feature, what is it?
     React component / view ......... features/<f>/components/
     reusable hook / effect ......... features/<f>/hooks/use-*.ts
     Apollo client / gql documents .. features/<f>/api/
     pure transform / error mapper .. features/<f>/helpers/
     types / constants / i18n ....... features/<f>/{types,constants,i18n}/
   Export the public surface from features/<f>/index.ts.

4. Is it generic, framework-level, feature-agnostic plumbing?
     yes -> a foundational shared layer:
              src/hooks, src/lib, src/utils, src/providers,
              src/shared, src/config, src/types, src/routes, src/stores
            (these may NOT import from src/features)
     no  -> it probably belongs to a feature after all; re-read step 2.
```

If two features need the same code, it is shared by definition: lift it to a
foundational layer (or `src/components` if it is UI). Features never import each
other.

## Common mistakes

| Symptom from make lint-deps                     | Cause and fix                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features-import-via-public-api` on a deep path | importing `@/features/x/components/...` from `src/`; import the `index` barrel instead                                                                 |
| `no-cross-feature-imports`                      | feature A imports feature B; promote the shared code to a foundational layer or `src/components`                                                       |
| `no-shared-ui-to-features`                      | a `src/components` file imports a feature; invert it — pass the feature piece in as a prop/child (see how `pages/_app.tsx` injects the landing Header) |
| `no-shared-layers-to-features`                  | `src/hooks`/`src/lib`/etc. imports a feature; move the code into the feature or pass data in                                                           |
| `feature-allowed-folders`                       | a non-approved folder/file at a feature root (e.g. `services/`, `validations/`); use an allowed folder (`api`, `helpers`, etc.)                        |
| `src-feature-name-kebab-case`                   | a feature directory named `UserOnboarding`; rename to `user-onboarding`                                                                                |
| `no-circular`                                   | two modules import each other; break the cycle by extracting the shared piece                                                                          |
| `no-orphans`                                    | a new module nothing imports; wire it through a barrel/page, or it is dead code                                                                        |

## Naming

`src-feature-name-kebab-case` enforces lowercase kebab-case for **feature
directory names only** (`user-onboarding`, not `UserOnboarding`). It is the
deliberate, scoped replacement for CRM's global `no-uppercase-paths`, which is
**omitted** here on purpose. Shared and feature **component** directories are
currently PascalCase by convention (`UiButton`, `AppTheme`, `AboutUs`) and their
casing is not linted; a kebab-case / `ui-*` migration of those directories is
being carried out by sibling PRs. Document feature-name kebab-case as the hard
rule; treat component-directory casing as the migrating convention.

## Verification

```bash
make lint-deps   # dependency-cruiser on src pages tests
```

Treat any error as the architecture telling you a file is in the wrong layer. Fix
the import path or move the file; never edit `.dependency-cruiser.js` to silence
it. Before commit, run the full gate:

```bash
make format      # Prettier (run before lint)
make lint        # lint-next + lint-tsc + lint-md + lint-deps
```

## Go deeper

- `reference/dependency-cruiser-rules.md` — every rule, severity, and exception.
- `examples/layered-flow.md` — the real landing sign-up flow end to end, the
  `pages/` composition-root exception, and a worked lint-deps fix.
- `.dependency-cruiser.js` — the source of truth for boundaries.
- `AGENTS.md` — the repo's test-coverage and Definition-of-Done contract.
