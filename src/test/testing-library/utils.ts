import { fireEvent, screen } from '@testing-library/react';
import { t } from 'i18next';

import {
  fullNamePlaceholder,
  emailPlaceholder,
  passwordPlaceholder,
  submitButtonText,
  checkboxRole,
  buttonRole,
} from './constants';

export const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));

export const selectFormElements: () => {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
  signUpButton: HTMLElement;
} = () => {
  try {
    const fullNameInput: HTMLInputElement = screen.getByPlaceholderText(fullNamePlaceholder);
    const emailInput: HTMLInputElement = screen.getByPlaceholderText(emailPlaceholder);
    const passwordInput: HTMLInputElement = screen.getByPlaceholderText(passwordPlaceholder);
    const privacyCheckbox: HTMLInputElement = screen.getByRole(checkboxRole);
    const signUpButton: HTMLElement = screen.getByRole(buttonRole, {
      name: submitButtonText,
    });

    return { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to select form elements: ${error.message}`);
    } else {
      throw new Error('An unknown error occurred');
    }
  }
};

export const fillForm: (
  fullNameValue?: string,
  emailValue?: string,
  passwordValue?: string,
  isChecked?: boolean
) => {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
} = (fullNameValue = '', emailValue = '', passwordValue = '', isChecked = false) => {
  if (emailValue && !emailValue.includes('@')) {
    throw new Error('Invalid email format');
  }

  if (passwordValue && passwordValue.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton } =
    selectFormElements();

  fireEvent.change(fullNameInput, { target: { value: fullNameValue } });
  fireEvent.change(emailInput, { target: { value: emailValue } });
  fireEvent.change(passwordInput, { target: { value: passwordValue } });

  if (isChecked) fireEvent.click(privacyCheckbox);

  fireEvent.click(signUpButton);

  return { fullNameInput, emailInput, passwordInput, privacyCheckbox };
};

export const checkElementsInDocument: (...elements: (HTMLElement | null)[]) => void = (
  ...elements
) => {
  elements.forEach(element => expect(element).toBeInTheDocument());
};
