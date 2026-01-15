import { test, Locator, Route, expect } from '@playwright/test';
import { t } from 'i18next';
import { Response } from 'playwright';

import { checkCheckbox } from '../utils/checkCheckbox';
import { fillInput } from '../utils/fillInput';

import { userData, graphqlEndpoint } from './constants';
import { getFormFields, responseErrorFilter, responseFilter, successResponse } from './utils';

const errorTitleText: string = t('notifications.error.title');
const successTitleText: string = t('notifications.success.title');
const backToFormButton: string = t('notifications.error.button');
const retryButtonText: string = t('notifications.error.retry_button');

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

test('Submit the registration form, verify error notification, and return to filled form', async ({
  page,
}) => {
  const { initialsInput, emailInput, passwordInput, policyTextCheckbox, signupButton } =
    getFormFields(page);

  await page.goto('/');

  await fillInput(initialsInput, userData.fullName);
  await fillInput(emailInput, userData.email);
  await fillInput(passwordInput, userData.password);
  await checkCheckbox(policyTextCheckbox);

  await page.route(graphqlEndpoint, serverErrorResponse);
  const responsePromise: Promise<Response> = page.waitForResponse(responseErrorFilter);

  await signupButton.click();

  await responsePromise;

  const errorTitle: Locator = page.getByText(errorTitleText);
  await expect(errorTitle).toBeVisible();

  const backButton: Locator = page.getByRole('button', { name: backToFormButton });
  await expect(backButton).toBeEnabled();
  await backButton.click();
  await expect(initialsInput).toHaveValue(userData.fullName);
  await expect(emailInput).toHaveValue(userData.email);
  await expect(passwordInput).toHaveValue(userData.password);
  await expect(policyTextCheckbox).toBeChecked();

  await page.unroute(graphqlEndpoint);

  await page.route(graphqlEndpoint, successResponse);
  const successResponsePromise: Promise<Response> = page.waitForResponse(responseFilter);

  await signupButton.click();
  await successResponsePromise;

  const successTitle: Locator = page.getByText(successTitleText);
  await expect(successTitle).toBeVisible();
});

test('Submit the registration form, get error, retry submission, and succeed', async ({ page }) => {
  const { initialsInput, emailInput, passwordInput, policyTextCheckbox, signupButton } =
    getFormFields(page);

  await page.goto('/');

  await fillInput(initialsInput, userData.fullName);
  await fillInput(emailInput, userData.email);
  await fillInput(passwordInput, userData.password);
  await checkCheckbox(policyTextCheckbox);

  let requestCount: number = 0;
  await page.route(graphqlEndpoint, async route => {
    requestCount += 1;
    if (requestCount <= 2) {
      await serverErrorResponse(route);
      return;
    }
    await successResponse(route);
  });

  await signupButton.click();
  const errorTitle: Locator = page.getByText(errorTitleText);
  await expect(errorTitle).toBeVisible();

  const backButton: Locator = page.getByRole('button', { name: backToFormButton });
  await expect(backButton).toBeEnabled();
  await backButton.click();

  await expect(initialsInput).toHaveValue(userData.fullName);
  await expect(emailInput).toHaveValue(userData.email);
  await expect(passwordInput).toHaveValue(userData.password);
  await expect(policyTextCheckbox).toBeChecked();

  await signupButton.click();
  await expect(errorTitle).toBeVisible();

  const retryButton: Locator = page.getByRole('button', { name: retryButtonText });
  await retryButton.click();

  const successNotification: Locator = page.getByText(successTitleText);
  await expect(successNotification).toBeVisible();

  await page.unroute(graphqlEndpoint);
});
