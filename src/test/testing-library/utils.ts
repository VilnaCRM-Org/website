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
  const fullNameInput: HTMLInputElement = screen.getByPlaceholderText(fullNamePlaceholder);
  const emailInput: HTMLInputElement = screen.getByPlaceholderText(emailPlaceholder);
  const passwordInput: HTMLInputElement = screen.getByPlaceholderText(passwordPlaceholder);
  const privacyCheckbox: HTMLInputElement = screen.getByRole(checkboxRole);
  const signUpButton: HTMLElement = screen.getByRole(buttonRole, {
    name: submitButtonText,
  });

  return { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton };
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
