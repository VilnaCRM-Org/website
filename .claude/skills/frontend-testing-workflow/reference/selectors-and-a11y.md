# Selectors And Accessibility

Tests describe behavior the user can perceive, so they double as accessibility
pressure: if the UI cannot be selected the way a user reaches it, that is a defect
in the component, not the test. This matches the behavior-first guidance in the
repo root [agents.md](../../../../agents.md).

## Locator priority

Use the first option that fits; drop to a lower one only when the UI genuinely
has no accessible name.

1. Role and accessible name — RTL `getByRole('button', { name })`, Playwright
   `getByRole`.
2. Label text — `getByLabelText` (RTL) / `getByLabel` (Playwright) for form
   controls.
3. Associated text — `getByPlaceholderText` (RTL) / `getByPlaceholder` (Playwright),
   plus `getByAltText` and `getByText`, for inputs and images.
4. Structure with no accessible name — Playwright `locator()` / CSS as a last
   resort (for example, a wrapping `section` or a submit `button[type="submit"]`).

## Avoid data-testid

The website does not lean on `data-testid` for queries, and there is no eslint
rule banning it — the discipline is editorial. If a control needs a test-only
attribute to be findable, that usually means it lacks an accessible name; add the
`aria-label`, label association, or visible text instead, and the production a11y
improves with the test.

## Assert localized text

Resolve expected strings through the i18next `t()` function (or a localized regex
built from it), never hardcoded English. This keeps translation-sensitive
behavior covered and the assertion stable across locales. Module-scope `t()` is
safe in these specs because i18next init is synchronous.
