import { test, Locator, expect } from '@playwright/test';

import { currentLanguage, placeholders, screenSizes } from '@/test/visual/constants';

import {errorResponse, ErrorResponseProps} from './graphqlMocks';

const serverErrorResponse:ErrorResponseProps = {status: 500, message: 'Unauthorized',code: 'UNAUTHORIZED'};

test.describe('Form Submission Server Error Test', () => {
  for (const screen of screenSizes) {
    test(`Server error notification - ${screen.name}`, async ({ page }) => {
      await page.route('**/graphql', (route) =>  errorResponse(route, serverErrorResponse));

      await page.goto('/');

      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await page.setViewportSize({ width: screen.width, height: screen.height });

      await page.waitForFunction(() => document.readyState === 'complete');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      const form: Locator = page.getByTestId('auth-form');
      await expect(form).toBeVisible();

      await page.getByPlaceholder(placeholders.name).fill('John Doe');
      await page.getByPlaceholder(placeholders.email).fill('john@example.com');
      await page.getByPlaceholder(placeholders.password).fill('SecurePassword123');
      await page.getByRole('checkbox').check();

      const submitButton: Locator = page.locator('button[type="submit"]');
      await submitButton.click();

      const serverErrorBox: Locator = page.getByTestId('error-box');
      await serverErrorBox.waitFor({ state: 'visible' });
      await expect(serverErrorBox).toBeVisible();

      await page.waitForFunction(() => {
        const errorBox: Element | null = document.querySelector('[data-testid="error-box"]');
        return (
          errorBox &&
          !errorBox.classList.contains('animating') &&
          window.getComputedStyle(errorBox).opacity === '1'
        );
      });
      await expect(page).toHaveScreenshot(`${currentLanguage}_${screen.name}_error.png`);
    });
  }
});
