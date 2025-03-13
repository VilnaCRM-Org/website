import { test, Locator, Route } from '@playwright/test';
import { Response } from 'playwright';

import { checkCheckbox } from '../utils/checkCheckbox';
import { fillInput } from '../utils/fillInput';

import {
  placeholderInitials,
  placeholderEmail,
  placeholderPassword,
  signUpButton,
  policyText,
  userData,
  graphqlEndpoint,
} from './constants';
import { responseErrorFilter } from './utils';

async function serverErrorResponse(route: Route): Promise<void> {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({
      errors: [
        {
          message: 'Internal Server Error',
          code: 500,
        },
      ],
    }),
  });
}

test('Submit the registration form and verify error notification', async ({ page }) => {
  const initialsInput: Locator = page.getByPlaceholder(placeholderInitials);
  const emailInput: Locator = page.getByPlaceholder(placeholderEmail);
  const passwordInput: Locator = page.getByPlaceholder(placeholderPassword);
  const policyTextCheckbox: Locator = page.getByLabel(policyText);

  const signupButton: Locator = page.getByRole('button', {
    name: signUpButton,
  });

  await page.goto('/');

  await fillInput(initialsInput, userData.fullName);
  await fillInput(emailInput, userData.email);
  await fillInput(passwordInput, userData.password);
  await checkCheckbox(policyTextCheckbox);

  await page.route(graphqlEndpoint, serverErrorResponse);

  const responsePromise: Promise<Response> = page.waitForResponse(responseErrorFilter);

  await signupButton.click();

  await responsePromise;

  const errorNotification: Locator = page.getByTestId('error-box');

  await errorNotification.waitFor({ state: 'visible' });
});
