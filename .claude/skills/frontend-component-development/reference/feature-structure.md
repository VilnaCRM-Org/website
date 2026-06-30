# Feature Structure

This repo is feature-based (adapted from bulletproof-react). There is NO
`src/modules` layer. Feature directory names must be lowercase kebab-case — the
`src-feature-name-kebab-case` rule in `.dependency-cruiser.js` fails the build
otherwise.

## Feature layout

A feature owns its UI, data access, and copy:

```text
src/features/<feature>/
  api/         # Apollo queries/mutations and service types
  assets/      # SVG and image assets
  components/  # feature-owned React components
  constants/
  helpers/
  hooks/
  i18n/        # en.json + uk.json
  routes/
  types/
  utils/
  index.ts     # public API barrel
```

Only those folders plus `index.ts` are allowed at a feature root — the
`feature-allowed-folders` rule flags anything else. There is no `store/` and no
`repositories/`; data access lives in `api/`. Create only the folders the
feature actually needs.

Existing features: `landing`, `swagger`, `registration`, `documentation`,
`example`.

## Public API and boundaries

- Export a feature's surface from its `index.ts` and import features only
  through that barrel. ESLint forbids `@/features/*/*` deep imports and
  dependency-cruiser enforces `features-import-via-public-api`.
- A feature must not import a sibling feature (`no-cross-feature-imports`); share
  through `src/components` or the foundational layers instead.
- Shared UI (`src/components`) and foundational layers (`src/hooks`, `src/lib`,
  `src/providers`, `src/utils`, `src/config`, `src/types`, `src/stores`) must not
  depend on any feature (`no-shared-ui-to-features`,
  `no-shared-layers-to-features`).

## Shared components

Reusable, feature-agnostic primitives live in `src/components/` with the `ui-*`
prefix (target: kebab-case folder `ui-button/` exporting `UiButton`) and are
re-exported from `src/components/index.ts`. Legacy PascalCase `Ui*` folders are
being migrated to kebab-case; treat kebab-case `ui-*` as the standard for new
primitives.

A component folder typically groups its parts:

```text
ui-button/
  index.tsx    # the component (default export)
  styles.ts    # sx style fragments (default-exported object)
  types.ts     # prop types
```
