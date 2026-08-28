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

## Sign-up form contract

The sign-up form is the only surface on this site that accepts user input, so a few of its
rules are load-bearing rather than incidental (issues #382 and #378):

- **Credential fields.** `FullName`, `Email`, `Password` and `ConfirmPassword` each forward
  an `id`, a `name` and an `autocomplete` token to the rendered input, so labels resolve and
  password managers can offer a generated password. `ConfirmPassword` is a client-side typo
  guard only — it never reaches the `createUser` mutation.
- **Password policy.** 8–64 characters with at least one digit, one uppercase and one
  lowercase letter (Unicode-aware, so Cyrillic passwords are treated the same). The rules are
  stated up front in a visually-hidden description tied to the field, not only in the
  pointer-only tooltip.
- **Error copy.** Auth-flow failures always render a generic localized message. Never surface
  `graphQLErrors[].message` verbatim: it turns the form into an account-enumeration oracle.
- **Telemetry.** A failed submission calls `reportHandledError` (`src/lib/telemetry`), which
  reports the exception with static `feature`/`action` tags and nothing derived from the
  submitted values.
- **Transport.** The endpoint the form POSTs to is validated in `src/config/env.ts`: remote
  cleartext `http://` fails the build; `http://` is accepted only for loopback.

## Internationalisation

Localized strings live in `src/features/landing/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
