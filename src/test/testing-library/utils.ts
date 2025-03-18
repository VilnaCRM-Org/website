import { MockedResponse } from '@apollo/client/testing';
import { fireEvent, screen } from '@testing-library/react';
import { t } from 'i18next';

import { CreateUserInput } from '@/test/apollo-server/types';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';

import {
  fullNamePlaceholder,
  emailPlaceholder,
  passwordPlaceholder,
  submitButtonText,
  checkboxRole,
  buttonRole,
  testEmail,
  testInitials,
  testPassword,
} from './constants';

export const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));

class FormElementNotFoundError extends Error {
  constructor(elementName: string, cause?: Error) {
    super(`Form element "${elementName}" not found: ${cause?.message || ''}`);
    this.name = 'FormElementNotFoundError';
  }
}

export const getFormElements: () => {
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
      throw new FormElementNotFoundError('form', error);
    }
    throw new FormElementNotFoundError('form');
  }
};

export const fillForm: (
  fullNameValue?: string,
  emailValue?: string,
  passwordValue?: string,
  checkPrivacyPolicy?: boolean
) => {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
} = (fullNameValue = '', emailValue = '', passwordValue = '', checkPrivacyPolicy = false) => {
  if (fullNameValue && fullNameValue.length < 2) {
    throw new Error('Full name must be at least 2 characters');
  }

  if (emailValue && !emailValue.includes('@')) {
    throw new Error('Invalid email format');
  }

  if (passwordValue && passwordValue.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton } =
    getFormElements();

  fireEvent.change(fullNameInput, { target: { value: fullNameValue } });
  fireEvent.change(emailInput, { target: { value: emailValue } });
  fireEvent.change(passwordInput, { target: { value: passwordValue } });
  if (checkPrivacyPolicy) fireEvent.click(privacyCheckbox);

  fireEvent.click(signUpButton);


  return { fullNameInput, emailInput, passwordInput, privacyCheckbox };
};

export const checkElementsInDocument: (...elements: (HTMLElement | null)[]) => void = (
  ...elements
) => {
  elements.forEach(element => expect(element).toBeInTheDocument());
};

const input: CreateUserInput = {
  email: testEmail,
  initials: testInitials,
  password: testPassword,
  clientMutationId: '132',
};

export const rejectedMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
    variables: { input },
  },
  result: {
    errors: [
      {
        message: 'A user with this email already exists.',
        locations: [{ line: 1, column: 1 }],
        path: ['createUser'],
        extensions: {
          code: 'BAD_USER_INPUT',
        },
      },
    ],
  },
};

export const mockInternalServerErrorResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
    variables: { input },
  },
  result: {
    errors: [
      {
        message: 'Internal Server Error.',
        locations: [{ line: 1, column: 1 }],
        path: ['createUser'],
        extensions: {
          code: 'BAD_USER_INPUT',
        },
      },
    ],
  },
};

export type SetIsOpenType = jest.Mock<(isOpen: boolean) => void>;
