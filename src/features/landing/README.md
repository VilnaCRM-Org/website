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

## Component notes

Rationale that used to live as comments in the source (ADR 0005); the tests named here
are what pin each behaviour.

- **Header drawer has no `role`.** `role="menu"` used to be set on `Drawer`, and MUI
  forwards it to the modal root — the wrapper holding the backdrop and the paper. ARIA
  gives `menu` required owned elements (`menuitem` and friends), so a backdrop plus a
  `[role=dialog]` made that root fail axe's `aria-required-children` at critical impact
  (SC 1.3.1), found by the interaction-state scan from #369. Neither alternative works:
  `menuitem` on the nav links would override their `link` role and oblige the full APG
  menu keyboard model, and moving `role="menu"` onto the inner `<nav>` would destroy the
  navigation landmark. This is site navigation inside a modal dialog, which is exactly
  what MUI already exposes (`role="dialog"`, `aria-modal="true"`, `tabIndex={-1}` on the
  paper slot for a `temporary` drawer, with a real `<nav>` list inside). Tests locate the
  open drawer by the `dialog` role — in jsdom and in all three browsers — so an MUI upgrade
  that stopped emitting it fails loudly. Naming that dialog is tracked in #435; the name
  has to go on the paper slot, because props land on the modal root, which is
  `role="presentation"`, where `aria-label` is prohibited.
- **Header navigation is a factory bound to the live `router`**, never a module-scope
  handler: `useHeaderNavigation` keeps the router in scope and `useScrollOnRouteChange`
  owns the `routeChangeComplete` scroll effect. Anchor scroll covers same-page navigation
  and the contacts shortcut; any other route navigates first, then scrolls
  (`navigateToLink` owns the fallback).
- **`scrollToAnchor`** schedules a fallback so the `MutationObserver` never leaks when the
  target appears late, and disconnects immediately when no valid id is supplied.
- **For-who shapes are decorative**: empty `alt` plus `aria-hidden`, so assistive tech
  skips them. In `styles.screens.ts` / `styles.shapes.ts` the waves, hexagon and triangle
  are hidden on mobile and shown from tablet up; the point group only on desktop.
- **`NOTIFICATION_ANIMATION_DURATION`** (`constants/index.ts`) is the fade in/out time the
  Notification component uses, in milliseconds.
- **`notification/styles.error.ts`** styles the error state; `styles.success.ts` the
  success state, whose sizing is explained in
  [`docs/sign-up-hardening.md`](../../../docs/sign-up-hardening.md).
- The sign-up form, its validations, its telemetry and its shared input primitives are
  documented finding by finding in that same note.

## Internationalisation

Localized strings live in `src/features/landing/i18n/en.json` and `uk.json` and are read
through the `t()` helper (react-i18next). Assert localized text via `t()`, not hardcoded
English.
