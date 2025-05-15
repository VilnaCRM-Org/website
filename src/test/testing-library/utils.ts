import { TypedDocumentNode } from '@apollo/client';
import { MockedResponse } from '@apollo/client/testing';
import { fireEvent, screen } from '@testing-library/react';
import { t } from 'i18next';
import { AriaRole } from 'react';

import { CreateUserInput } from '@/test/apollo-server/types';

import { SignUpInput } from '../../features/landing/api/service/types';
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
export interface GetElementsResult {
  fullNameInput: HTMLInputElement | null;
  emailInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  privacyCheckbox: HTMLInputElement | null;
}
interface ExtendedGetElementsResult extends GetElementsResult {
  signUpButton: HTMLElement | null;
}
export const getFormElements: () => ExtendedGetElementsResult = () => {
  const getElementSafe: <T extends HTMLInputElement>(
    queryFunction: () => T,
    elementName: string
  ) => T | null = <T extends HTMLElement>(queryFunction: () => T, elementName: string): T => {
    try {
      return queryFunction();
    } catch (error) {
      throw new FormElementNotFoundError(
        `Form element "${elementName}" not found using query: ${queryFunction.toString()}`
      );
    }
  };

  return {
    fullNameInput: getElementSafe(
      () => screen.getByPlaceholderText(fullNamePlaceholder),
      'fullNameInput'
    ),
    emailInput: getElementSafe(() => screen.getByPlaceholderText(emailPlaceholder), 'emailInput'),
    passwordInput: getElementSafe(
      () => screen.getByPlaceholderText(passwordPlaceholder),
      'passwordInput'
    ),
    privacyCheckbox: getElementSafe(() => screen.getByRole(checkboxRole), 'privacyCheckbox'),
    signUpButton: getElementSafe(
      () => screen.getByRole(buttonRole, { name: submitButtonText }),
      'signUpButton'
    ),
  };
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
) => GetElementsResult = (
  fullNameValue = '',
  emailValue = '',
  passwordValue = '',
  acceptPrivacyPolicy = false
) => {
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
type RequestType = { query: TypedDocumentNode<SignUpInput>; variables: { input: CreateUserInput } };
const request: RequestType = {
  query: SIGNUP_MUTATION,
  variables: { input },
};

export const mockUserExistsErrorResponse: MockedResponse = {
  request,
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
  request,
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
  loading?: boolean;
}
