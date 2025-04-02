import { MockedResponse } from '@apollo/client/testing';
import { fireEvent, screen } from '@testing-library/react';
import { t } from 'i18next';
import { AriaRole } from 'react';

import { CreateUserInput } from '@/test/apollo-server/types';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import {
  fullNamePlaceholder,
  emailPlaceholder,
  passwordPlaceholder,
  submitButtonText,
  buttonRole,
  testEmail,
  testInitials,
  testPassword,
} from './constants';

const checkboxRole: AriaRole = 'checkbox';

export const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));

class FormElementNotFoundError extends Error {
  constructor(elementName: string, cause?: Error) {
    super(`Form element "${elementName}" not found: ${cause?.message || ''}`);
    this.name = 'FormElementNotFoundError';
  }
}

export const getFormElements: () => {
  fullNameInput: HTMLInputElement | null;
  emailInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  privacyCheckbox: HTMLInputElement | null;
  signUpButton: HTMLElement | null;
} = () => {
  const missingElements: string[] = [];

  const getElementSafe: <T extends HTMLInputElement>(
    queryFunction: () => T,
    elementName: string
  ) => T | null = <T extends HTMLInputElement>(
    queryFunction: () => T,
    elementName: string
  ): T | null => {
    try {
      return queryFunction();
    } catch (error) {
      missingElements.push(elementName);
      return null;
    }
  };

  const fullNameInput: HTMLInputElement | null = getElementSafe(
    () => screen.getByPlaceholderText(fullNamePlaceholder),
    'fullNameInput'
  );
  const emailInput: HTMLInputElement | null = getElementSafe(
    () => screen.getByPlaceholderText(emailPlaceholder),
    'emailInput'
  );
  const passwordInput: HTMLInputElement | null = getElementSafe(
    () => screen.getByPlaceholderText(passwordPlaceholder),
    'passwordInput'
  );
  const privacyCheckbox: HTMLInputElement | null = getElementSafe(
    () => screen.getByRole(checkboxRole),
    'privacyCheckbox'
  );
  const signUpButton: HTMLInputElement | null = getElementSafe(
    () => screen.getByRole(buttonRole, { name: submitButtonText }),
    'signUpButton'
  );

  if (missingElements.length > 0) {
    throw new FormElementNotFoundError(`Missing elements: ${missingElements.join(', ')}`);
  }

  return { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton };
};

export const validateFormInput: (
  fullNameValue: string,
  emailValue: string,
  passwordValue: string
) => void = (fullNameValue: string, emailValue: string, passwordValue: string): void => {
  if (fullNameValue && fullNameValue.length < 2) {
    throw new Error('Full name must be at least 2 characters');
  }

  if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    throw new Error('Invalid email format');
  }

  if (passwordValue && passwordValue.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
};

export const fillForm: (
  fullNameValue?: string,
  emailValue?: string,
  passwordValue?: string,
  acceptPrivacyPolicy?: boolean
) => {
  fullNameInput: HTMLInputElement | null;
  emailInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  privacyCheckbox: HTMLInputElement | null;
} = (fullNameValue = '', emailValue = '', passwordValue = '', acceptPrivacyPolicy = false) => {
  validateFormInput(fullNameValue, emailValue, passwordValue);

  const { fullNameInput, emailInput, passwordInput, privacyCheckbox, signUpButton } =
    getFormElements();

  if (fullNameInput) {
    fireEvent.change(fullNameInput, { target: { value: fullNameValue } });
  }

  if (emailInput) {
    fireEvent.change(emailInput, { target: { value: emailValue } });
  }

  if (passwordInput) {
    fireEvent.change(passwordInput, { target: { value: passwordValue } });
  }

  if (acceptPrivacyPolicy && privacyCheckbox) {
    fireEvent.click(privacyCheckbox);
  }

  if (signUpButton) {
    fireEvent.click(signUpButton);
  }

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
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
    ],
  },
};

export type SetIsOpenType = jest.Mock<(isOpen: boolean) => void>;
export type OnSubmitType = jest.Mock<Promise<void>, [RegisterItem]>;

export interface AuthFormWrapperProps {
  onSubmit: OnSubmitType;
  serverErrorMessage: string;
}
