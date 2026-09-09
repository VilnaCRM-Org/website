# Accessibility Review

## Checklist

- [ ] Buttons and links expose accessible names (text content or `aria-label`).
- [ ] Icon-only controls (drawer toggle, close) carry an `aria-label`, sourced
      from i18next `t()` so `en`/`uk` both stay covered.
- [ ] Decorative images use `alt=""` with `aria-hidden="true"`; meaningful
      images use a localized `alt`.
- [ ] Inputs have labels and react-hook-form errors stay associated with their
      field so the message is announced.
- [ ] Async status is announced — e.g. the registration loader uses
      `aria-live="polite"`.
- [ ] Dialogs/menus manage focus and expose a title or accessible name; the
      drawer uses the correct `role`.
- [ ] Color contrast stays readable across both color themes.
- [ ] Keyboard interaction works for the drawer/menu, dialogs, forms, and route
      changes.

## Lock regressions with Playwright

Mirror the existing `src/test/e2e` specs: query the way a user perceives the UI
with `getByRole`, `getByLabel`, and `getByAltText`, using localized strings from
the feature constants rather than hardcoded English.

```ts
import { test, expect, Locator } from '@playwright/test';

test('header logo is reachable by its accessible name', async ({ page }) => {
  await page.goto('/');
  const logo: Locator = page.getByRole('link', { name: logoAlt });
  await expect(logo).toBeVisible();
});
```

The same locator priority applies to React Testing Library specs in
`src/test/testing-library` — prefer `getByRole`/`getByLabelText`/`getByAltText`/
`getByText` over `data-testid`, per `AGENTS.md`.

## Tooling

- `make lighthouse-desktop` / `make lighthouse-mobile` carry an accessibility
  category budget — they catch contrast, label, and tap-target regressions on
  `/` and `/swagger`.
- `make test-e2e` (Mockoon-backed Playwright) exercises real keyboard and role
  interactions.
- `make test-visual` guards appearance, including focus-visible states, as a
  supplement to the behavior assertions above.
