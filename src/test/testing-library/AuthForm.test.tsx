import { MutationFunction } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import {
  checkElementsInDocument,
  fillForm,
  selectFormElements,
} from '@/test/testing-library/utils';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import {
  CreateUserPayload,
  SignUpVariables,
} from '../../features/landing/components/AuthSection/AuthForm/types';

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

const mockSetIsAuthenticated: jest.Mock<(isAuthenticated: boolean) => void> = jest.fn<
  (isAuthenticated: boolean) => void,
  [boolean]
>();
const mockSignupMutation: MutationFunction<CreateUserPayload, SignUpVariables> = jest.fn();

describe('AuthForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText, getByTestId } = render(
      <MockedProvider>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
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

    expect(getByTestId('auth-form')).toBeVisible();
    expect(loader).not.toBeInTheDocument();
    expect(serverErrorMessage).not.toBeInTheDocument();
  });

  it('renders input fields', () => {
    render(
      <MockedProvider>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });

  it('correct linkage between inputs and values', async () => {
    render(
      <MockedProvider addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
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
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
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
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
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

  it('calls setIsAuthenticated(true) after successful registration', async () => {
    const { getByTestId } = render(
      <MockedProvider addTypename={false}>
        <AuthForm setIsAuthenticated={mockSetIsAuthenticated} signupMutation={mockSignupMutation} />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    fireEvent.submit(getByTestId('auth-form'));

    await waitFor(() => {
      expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
    });
  });
});
