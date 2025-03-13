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
import { responseFilter } from './utils';

async function successResponse(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        createUser: {
          user: {
            email: userData.email,
            initials: userData.fullName,
            id: '12345',
            confirmed: true,
          },
          clientMutationId: 'some-client-id',
        },
      },
    }),
  });
}

test('Submit the registration form and verify success notification', async ({ page }) => {
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

  await page.route(graphqlEndpoint, successResponse);

  const responsePromise: Promise<Response> = page.waitForResponse(responseFilter);

  await signupButton.click();

  await responsePromise;

  const successNotification: Locator = page.getByTestId('success-box');

  await successNotification.waitFor({ state: 'visible' });

  await page.getByTestId('success-box').getByRole('button').click();
});
