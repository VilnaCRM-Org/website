import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, waitFor} from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';


import { SIGNUP_MUTATION } from '../../features/landing/api/service/userService';
import AuthLayout from '../../features/landing/components/AuthSection/AuthForm/AuthLayout';

import {
  buttonRole,
  checkboxRole,
  emailPlaceholder,
  fullNamePlaceholder,
  passwordPlaceholder,
  submitButtonText,
  testEmail,
  testInitials,
  testPassword,
} from './constants';
import {
  fillForm,
  mockInternalServerErrorResponse,
  rejectedMockResponse, selectFormElements,
} from './utils';

const statusRole: string = 'status';
const alertRole: string = 'alert';

const notificationId: string = 'notification';
const formTitleText: string = t('sign_up.form.heading_main');
const notificationTitle: string = t('notifications.success.title');

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


describe('AuthLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders AuthComponent component correctly', () => {
    const { getByText, getByPlaceholderText, getByRole } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    const formTitle: HTMLElement = getByText(formTitleText);
    expect(formTitle).toBeInTheDocument();
    expect(getByPlaceholderText(fullNamePlaceholder)).toBeInTheDocument();
    expect(getByPlaceholderText(emailPlaceholder)).toBeInTheDocument();
    expect(getByPlaceholderText(passwordPlaceholder)).toBeInTheDocument();
    expect(getByRole(checkboxRole)).toBeInTheDocument();
    expect(getByRole(buttonRole, { name: submitButtonText })).toBeInTheDocument();
  });

  it('displays loader and submits form successfully without errors', async () => {
    const { getByRole, queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
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
  test('shows loading spinner during registration and hides it after completion', async () => {
    const { queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });
  });

  it('registration with server error', async () => {
    const { findByRole, getByPlaceholderText } = render(
      <MockedProvider mocks={[rejectedMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
    expect(serverErrorMessage).toHaveTextContent('A user with this email already exists.');

    expect(getByPlaceholderText(emailPlaceholder)).toHaveValue(testEmail);
    expect(getByPlaceholderText(passwordPlaceholder)).toHaveValue(testPassword);
  });
  it('shows success notification after successful authentication', async () => {
    const { getByTestId, getByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(getByTestId(notificationId)).toBeInTheDocument();
      const notification: HTMLElement = getByTestId(notificationId);
      expect(notification).toBeInTheDocument();
      expect(notification).toBeVisible();
      expect(getByText(notificationTitle)).toBeInTheDocument();
    });
  });
  it('resets form fields after successful registration', async () => {
    const { getByPlaceholderText, getByTestId } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(getByTestId(notificationId)).toBeInTheDocument();
      expect(getByPlaceholderText(fullNamePlaceholder)).toHaveValue('');
      expect(getByPlaceholderText(emailPlaceholder)).toHaveValue('');
      expect(getByPlaceholderText(passwordPlaceholder)).toHaveValue('');
    });
  });

  it('should successfully submit the form and update state', async () => {
   const {getByTestId}= render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(getByTestId('success-box')).toBeInTheDocument();
    });
  });

  it('should handle errors correctly and update state', async () => {
    const {  findByRole} = render(
      <MockedProvider mocks={[mockInternalServerErrorResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
    expect(serverErrorMessage).toHaveTextContent('Internal Server Error.');
  });
  it('resets the form after successful submit with no errors', async () => {
   const {getByTestId, queryByRole}= render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox}= selectFormElements();

    await waitFor(() => {
      expect(fullNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();

      expect(getByTestId('success-box')).toBeInTheDocument();
      expect(queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
