import { test, Locator } from '@playwright/test';
import { t } from 'i18next';

import fillForm from '../utils/fillForm';

import {
  placeholderInitials,
  placeholderEmail,
  placeholderPassword,
  signUpButton,
  policyText,
} from './constants';

const backToFormSuccess:string = t('notifications.success.button');

test('Show notificationSuccess component', async ({ page }) => {
  const initialsInput: Locator = page.getByPlaceholder(placeholderInitials);
  const emailInput: Locator = page.getByPlaceholder(placeholderEmail);
  const passwordInput: Locator = page.getByPlaceholder(placeholderPassword);
  const policyTextCheckbox: Locator = page.getByLabel(policyText);

  const signupButton: Locator = page.getByRole('button', {
    name: signUpButton,
  });

  await page.goto('/');

  await fillForm({ initialsInput, emailInput, passwordInput, policyTextCheckbox });

  await signupButton.click();

  const backToForm: Locator = page.getByRole('button', {name: backToFormSuccess});
  await backToForm.click();
});
