# Code Organization Fixes

Feature directory names are lowercase kebab-case (enforced by
`dependency-cruiser` rule `src-feature-name-kebab-case`); a feature root may
only contain the `index.ts` barrel plus the folders listed in
`feature-allowed-folders`.

## Import A Feature Through Its Barrel

Problem: code reaches past a feature's public surface into a deep path.

```ts
// Bad — reaches past the feature barrel (fails ESLint no-restricted-imports
// on @/features/*/* and dependency-cruiser features-import-via-public-api):
import Landing from '@/features/landing/components/Landing/Landing';

// Good — import through the feature's public index.ts barrel:
import { LandingComponent } from '@/features/landing';
```

Export anything other features or pages need from the feature's `index.ts`;
everything else stays internal.

## Move Feature-Only UI Back To Its Feature

Problem: a component in `src/components/` imports landing i18n strings and an
`api/` GraphQL hook, so `no-shared-ui-to-features` fails.

Fix:

```text
src/features/landing/components/AuthSection/
```

Keep it feature-owned until at least two features use it without
feature-specific props, copy, or state. Only then promote it to
`src/components/ui-*`.

## Split Container Logic From Presentation

Problem: a component fetches data, maps Apollo errors, owns react-hook-form
state, and renders the full layout.

Fix:

```text
src/features/registration/
  hooks/useRegistrationForm.ts
  components/registration-form/registration-form.tsx
  components/registration-form/registration-form-fields.tsx
```

The hook owns data, the Apollo mutation, and side effects. The components render
props and translated UI via i18next `t()`.

## Replace Vague Utils With Named Helpers

`feature-allowed-folders` permits `helpers/` and `utils/` at feature level, but
the file name must describe the work. Cross-feature helpers move to `src/utils`
or `src/lib`.

Bad:

```text
src/features/landing/helpers/utils.ts
```

Better:

```text
src/features/landing/helpers/normalizeLink.ts
src/features/landing/helpers/handleApolloError.ts
```

Name helpers by the transformation or decision they perform. A small,
single-purpose helper is easy to test in `src/test/unit/`:

```ts
export function normalizeLink(href: string): string {
  return href.startsWith('/') ? href : `/${href}`;
}
```
