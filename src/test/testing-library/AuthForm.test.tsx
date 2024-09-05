import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import { SIGNUP_MUTATION } from '../../features/landing/api/service/userService';
import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';

import { testInitials, testEmail, testPassword } from './constants';

const fullNamePlaceholder: string = t('sign_up.form.name_input.placeholder');
const emailPlaceholder: string = t('sign_up.form.email_input.placeholder');
const passwordPlaceholder: string = t('sign_up.form.password_input.placeholder');

const submitButtonText: string = t('sign_up.form.button_text');

const formTitleText: string = t('sign_up.form.heading_main');
const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.name_input.required');
const passwordTipAltText: string = t('sign_up.form.password_tip.alt');

const statusRole: string = 'status';
const checkboxRole: string = 'checkbox';
const alertRole: string = 'alert';
const buttonRole: string = 'button';

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

const selectFormElements: () => {
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

const fillForm: (
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

const checkElementsInDocument: (...elements: (HTMLElement | null)[]) => void = (...elements) => {
  elements.forEach(element => expect(element).toBeInTheDocument());
};

describe('AuthForm', () => {
  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText } = render(
      <MockedProvider>
        <AuthForm />
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
        <AuthForm />
      </MockedProvider>
    );

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });

  it('successful registration', async () => {
    const { getByRole, queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthForm />
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
        <AuthForm />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
  });

  it('correct linkage between inputs and values', async () => {
    render(
      <MockedProvider addTypename={false}>
        <AuthForm />
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
        <AuthForm />
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
        <AuthForm />
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
