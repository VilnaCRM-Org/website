---
name: frontend-component-development
description: >-
  Use when building or changing React/TypeScript UI in the website repo — MUI 9
  + Emotion components, react-hook-form forms, hooks, or per-feature i18n inside
  src/features/* features and shared src/components ui-* primitives. Triggers on
  "add a component", "build a form", "style with sx", "feature component",
  "register a field", "translate UI copy", "useTranslation", "Controller".
---

# Frontend Component Development

Build and change presentational and feature UI the way this repo already does it.
Ground every change in nearby real files before writing new ones.

## Stack (verified)

- Next.js 16 (pages router), React 19, TypeScript 6.
- MUI 9 + Emotion (`@emotion/react`, `@emotion/styled`) for styling.
- `react-hook-form` for form state and validation.
- `react-i18next` / `i18next` for all user-facing copy.
- Apollo Client 4 for data (queries/mutations live in a feature's `api/`).

There is NO Redux/RTK, NO Zustand, and NO DI container here. Component state is
local React state plus `react-hook-form`; server state is Apollo. Do not
introduce a global store.

## When to use

Adding or editing a component, hook, form, or translation under
`src/features/<feature>/components/**` or a shared primitive under
`src/components/ui-*`. For test depth, file placement, complexity budgets, and
accessibility, route to the related skills at the end.

## Workflow

1. Find the boundary. Feature-owned UI lives in
   `src/features/<feature>/components/`; reusable primitives live in
   `src/components/` with the `ui-*` prefix.
2. Read the neighbors first — nearby `*.tsx`, `styles.ts`, `types.ts`, the
   feature `i18n/{en,uk}.json`, and the matching specs under `src/test/`.
3. Add or update tests for the behavior you change (see the testing skill).
4. Keep every user-facing string in `i18n/en.json` and `i18n/uk.json`.
5. Verify with `make format`, the focused unit suite, and `make lint`.

## Component rules

- Type props in a colocated `types.ts` and return `React.ReactElement` (the
  house convention), not `JSX.Element`.
- Style with MUI `sx` plus a colocated `styles.ts` that default-exports a plain
  object of style fragments (`sx={styles.title}`); keep static styles out of
  render. Reach for `styled` from `@mui/material` only for reused wrappers.
- Use theme tokens from the shared theme primitives (`UiColorTheme`,
  `UiBreakpoints`) instead of hardcoded colors/breakpoints.
- Icons and imagery are SVG assets under the feature's `assets/`, rendered via
  the optimized `Image` (or shared `UiImage`) with a translated `alt`.
  `@mui/icons-material` is NOT a dependency — do not add it.
- Import shared primitives from the `@/components` barrel; import another
  feature only through its `index.ts` public API. ESLint forbids `@/features/*/*`
  deep imports and dependency-cruiser enforces `features-import-via-public-api`,
  `no-cross-feature-imports`, and `no-shared-ui-to-features`.
- Keep presentational components free of data fetching; container/layout
  components own Apollo and `react-hook-form` and pass props down.

## Forms

The repo splits a container (owns `useForm`, the Apollo mutation, and submit)
from a presentational form that receives `control`, `handleSubmit`, and errors
as props (see `AuthSection/AuthForm/AuthLayout.tsx` → `AuthForm.tsx`).

- Wire fields through a `Controller` — the shared `ui-text-field-form` primitive
  wraps `Controller` around `UiInput` and renders the error message itself.
- Validation lives in small colocated helpers next to the form. Each validator
  returns `true` or a translation-keyed message via `t` from `i18next`, and is
  passed as the field's `rules.validate`.
- Map every validation message to a translation key, never a hardcoded string.

See [examples/localized-form.md](examples/localized-form.md).

## Internationalization

- Translations live per feature at `src/features/<feature>/i18n/en.json` and
  `i18n/uk.json`. Add the English and Ukrainian keys together; never ship one
  without the other.
- Read copy with `const { t } = useTranslation();` in components; module-scope
  `t` from `i18next` is safe in validators/helpers because init is synchronous.
- Use `<Trans>` when a string embeds markup (links, bold).

See [reference/i18n-patterns.md](reference/i18n-patterns.md).

## Verification

```bash
make format                  # Prettier (run before lint)
CI=1 make test-unit-client   # Client unit suite (jsdom, no Docker)
make lint                    # ESLint + tsc + markdownlint + dependency-cruiser
```

For visible layout or styling changes, also run:

```bash
make test-visual             # Visual regression (chromium/firefox/webkit)
make storybook-start         # Develop and QA the component in isolation
```

If a reviewed UI change makes baselines stale, regenerate them with
`make test-visual-update` and review the diff before committing.

## Related guides

Confirm the task against [../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md), then route to:

- [../frontend-testing-workflow/SKILL.md](../frontend-testing-workflow/SKILL.md)
  — test layers, scenario classes, and behavior-first assertions.
- [../code-organization/SKILL.md](../code-organization/SKILL.md) — file/folder
  placement, barrels, and kebab-case naming.
- [../complexity-management/SKILL.md](../complexity-management/SKILL.md) and
  [../quality-standards/SKILL.md](../quality-standards/SKILL.md) — keep new code
  within the repo's `make lint-metrics` budget.
- [../frontend-performance-accessibility/SKILL.md](../frontend-performance-accessibility/SKILL.md)
  — accessibility and performance of the rendered UI.

## Supporting files

- [examples/mui-feature-component.md](examples/mui-feature-component.md) — a
  presentational MUI feature component.
- [examples/localized-form.md](examples/localized-form.md) — a react-hook-form
  form with localized validation.
- [reference/feature-structure.md](reference/feature-structure.md) — feature and
  shared-component folder layout.
- [reference/mui-emotion-patterns.md](reference/mui-emotion-patterns.md) — MUI,
  Emotion, theme tokens, and icon guidance.
- [reference/i18n-patterns.md](reference/i18n-patterns.md) — translation file
  rules.
