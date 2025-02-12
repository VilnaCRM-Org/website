import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render,  waitFor,  } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import {
  checkElementsInDocument,
  fillForm,
  selectFormElements,
} from '@/test/testing-library/utils';

import { SIGNUP_MUTATION } from '../../features/landing/api/service/userService';
import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';

import { testInitials, testEmail, testPassword } from './constants';

const formTitleText: string = t('sign_up.form.heading_main');

const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.name_input.required');
const passwordTipAltText: string = t('sign_up.form.password_tip.alt');

const statusRole: string = 'status';
const alertRole: string = 'alert';

const emptyValue: string = '';

const authFormSelector: string = '.MuiBox-root';

const borderStyle: string = 'border: 1px solid #DC3939';

const fulfilledMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: () => true,
  result: variables => {
    const { input } = variables;
    const { initials, email, password, clientMutationId } = input;

    expect(input).not.toBeUndefined();
    expect(initials).toBe(testInitials);
    expect(email).toBe(testEmail);
    expect(password).toBe(testPassword);
    expect(clientMutationId).toBe('132');

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId: '132',
        },
      },
    };
  },
};
const rejectedMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
    variables: {
      input: {},
    },
  },
  error: { name: 'MockError', message: 'Server Error' },
};


const mockSetIsAuthenticated: jest.Mock<(isAuthenticated: boolean) => void> = jest.fn();
describe('AuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText } = render(
      <MockedProvider>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    const authForm: HTMLElement = container.querySelector(authFormSelector) as HTMLElement;
    const formTitle: HTMLElement = getByText(formTitleText);
    const nameInputLabel: HTMLElement = getByText(nameInputText);
    const emailInputLabel: HTMLElement = getByText(emailInputText);
    const passwordInputLabel: HTMLElement = getByText(passwordInputText);
    const passwordTipImage: HTMLElement = getByAltText(passwordTipAltText);

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    const loader: HTMLElement | null = queryByRole(statusRole);

    checkElementsInDocument(
      authForm,
      formTitle,
      nameInputLabel,
      emailInputLabel,
      passwordInputLabel,
      passwordTipImage
    );

    expect(loader).not.toBeInTheDocument();
    expect(serverErrorMessage).not.toBeInTheDocument();
  });

  it('renders input fields', () => {
    render(
      <MockedProvider>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });

  it('successful registration', async () => {
    const { getByRole, queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const loader: HTMLElement = getByRole(statusRole);
      expect(loader).toBeInTheDocument();
    });

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    expect(serverErrorMessage).not.toBeInTheDocument();
  });

  it('registration with server error', async () => {
    const { findByRole } = render(
      <MockedProvider mocks={[rejectedMockResponse]} addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
  });

  it('correct linkage between inputs and values', async () => {
    render(
      <MockedProvider addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm(
      testInitials,
      testEmail,
      testPassword,
      true
    );

    await waitFor(() => {
      expect(emailInput.value).toBe(testEmail);
      expect(passwordInput.value).toBe(testPassword);
      expect(fullNameInput.value).toBe(testInitials);
      expect(privacyCheckbox).toBeChecked();
    });
  });

  it('correct linkage between inputs and values with no data', async () => {
    const { getAllByText, queryByRole } = render(
      <MockedProvider addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm();

    await waitFor(() => {
      const requiredError: HTMLElement[] = getAllByText(requiredText);
      const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);

      expect(fullNameInput.value).toBe(emptyValue);
      expect(emailInput.value).toBe(emptyValue);
      expect(passwordInput.value).toBe(emptyValue);
      expect(privacyCheckbox).not.toBeChecked();

      expect(privacyCheckbox).toHaveStyle(borderStyle);

      expect(requiredError.length).toBe(3);
      expect(serverErrorMessage).not.toBeInTheDocument();
    });
  });

  it('Check onTouched mode', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByText } = render(
      <MockedProvider addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput } = selectFormElements();

    await user.click(fullNameInput);
    await user.click(emailInput);

    await waitFor(() => {
      const requiredError: HTMLElement = getByText(requiredText);
      expect(requiredError).toBeInTheDocument();
    });
  });
});
