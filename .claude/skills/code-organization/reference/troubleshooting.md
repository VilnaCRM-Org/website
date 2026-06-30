# Code Organization Troubleshooting

## Import Crosses Too Many Folders

If an import needs several `../` segments, check whether the `@/` alias should
be used (`@/*` resolves to `src/*`) or whether the importing file belongs closer
to the feature it consumes. Prefer `@/features/<feature>` (the barrel),
`@/components/...`, or a shared layer over long relative chains.

## Reaching Into A Feature's Internals

Importing `@/features/<feature>/<anything-but-index>` fails twice: ESLint
`no-restricted-imports` (pattern `@/features/*/*`) and dependency-cruiser
`features-import-via-public-api`. Export the symbol from the feature's
`index.ts` and import the feature through its barrel instead. The Next.js
`pages/` routing root is the one composition layer allowed to wire features.

## Component Feels Shared But Imports Feature State

Keep it in the feature. A component promoted to `src/components/ui-*` must not
depend on feature translations, feature `api/` GraphQL hooks, react-hook-form
state, or route-specific state — `no-shared-ui-to-features` forbids
`src/components` from importing any feature. Promote only once a second feature
needs it without feature-specific props, copy, or state.

## New Folder Name Is Unclear

`dependency-cruiser` only allows specific folder names inside a feature; using
anything else fails `make lint-deps` via `feature-allowed-folders`.

Allowed feature subfolders (plus the `index.ts` barrel): `api`, `assets`,
`components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`,
`utils`.

Do not introduce `repositories/`, `store/`, `services/`, or a stray root file:
data access is `api/` (GraphQL + Apollo Client), shared cross-cutting code goes
in a shared layer (`src/lib`, `src/shared`, `src/utils`, `src/hooks`), and there
is no per-feature store. Avoid `misc`, `common`, and `manager` names.

## Where Does Cross-Feature Or App-Wide Code Go

A feature must not import a sibling feature (`no-cross-feature-imports`), and
foundational layers must not import a feature (`no-shared-layers-to-features`).
Move genuinely shared code up:

- Reusable UI → `src/components/ui-*`.
- Pure helpers/utilities → `src/utils` or `src/lib`.
- Cross-cutting hooks → `src/hooks`.
- Providers/config/types → `src/providers`, `src/config`, `src/types`.

## Tests Are Hard To Place

Specs live under `src/test/**` grouped by test TYPE, not by feature path. Pick
the type folder for the layer you exercise and name the file after its subject:

```text
src/features/landing/helpers/normalizeLink.ts
src/test/unit/normalizeLink.test.ts

src/features/landing/components/AboutUs/AboutUs.tsx
src/test/testing-library/AboutUs.test.tsx
```

Apollo resolvers go in `src/test/apollo-server/**`. For Playwright, name e2e
specs by user journey under `src/test/e2e/`, and visual specs under
`src/test/visual/` with snapshots in the adjacent `*-snapshots/` folder.
