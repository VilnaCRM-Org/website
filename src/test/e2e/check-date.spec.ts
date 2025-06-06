import { test, expect, Locator } from '@playwright/test';

test('Checking the current year', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load', timeout: 3000 });

  const currentYear: number = new Date().getFullYear();
  const yearElements: Locator = page.getByText(currentYear.toString());

  const displayedYear: string | null = await yearElements.first().textContent();
  expect(displayedYear).toBe(currentYear.toString());
});
