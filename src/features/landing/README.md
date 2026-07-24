# Landing feature

The public marketing landing page: hero/header, product sections, and the sign-up form
wired to the user-service GraphQL mutation.

## Public API

Import the feature only through its barrel (`src/features/landing/index.ts`); never reach
across features by deep path (enforced by `make lint-deps`).

```ts
import { LandingComponent } from '@/features/landing';
```

- `LandingComponent` — the composed landing page. Rendered by `pages/index.tsx`.

## Structure

- `components/` — the section components (`header`, `about-us`, `why-us`, `possibilities`,
  `for-who-section`, `auth-section`, `notification`, `background-images`) plus the `landing`
  root that composes them. Each renderable section ships a co-located `*.stories.tsx`.
- `api/` — the Apollo data layer: `graphql/apollo.ts` (client + documents) and
  `service/userService.ts` (the typed create-user call and its `types.ts`).
- `hooks/` — feature hooks such as `useFormReset.ts`.
- `helpers/` — pure helpers (for example `handleApolloError.ts`).
- `constants/`, `types/` — feature-scoped constants and shared types.
- `i18n/` — localized copy.

## Data flow

Rendering follows Component -> Hook -> Apollo. Section components render UI and delegate
side effects to feature hooks; the hooks call the typed service in `api/service`, which
issues the mutation through the Apollo client in `api/graphql`. GraphQL errors are
normalized by `helpers/handleApolloError.ts` into localized messages.

## Internationalisation

Localized strings live in `src/features/landing/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
