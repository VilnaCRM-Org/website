import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import {fireEvent, render, waitFor} from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
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
  rejectedMockResponse,
  getFormElements,
} from './utils';


const statusRole: string = 'status';
const alertRole: string = 'alert';

const notificationId: string = 'notification';
const formTitleText: string = t('sign_up.form.heading_main');
const notificationTitle: string = t('notifications.success.title');
const requiredText: string = t('sign_up.form.email_input.required');
const successBoxId :string='success-box';
const errorTitle: string = t('notifications.error.title');

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
const internalServerErrorResponse: MockedResponse[] = [
  {
    request: {
      query: SIGNUP_MUTATION,
      variables: {
        input: {
          email: testEmail,
          initials: testInitials,
          password: testPassword,
          clientMutationId: '132',
        },
      },
    },
    result: {
      errors: [{ message: 'Internal Server Error', extensions: { statusCode: 500 } }],
    },
  },
];
interface GetElementsResult {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
  signUpButton: HTMLElement;
}
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
    const { getByRole, queryByRole, getByTestId, queryByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const loader: HTMLElement = getByRole(statusRole);
      expect(loader).toBeInTheDocument();
      expect(getByRole(statusRole)).toBeInTheDocument();
    });

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    expect(serverErrorMessage).not.toBeInTheDocument();

    await waitFor(() => {
       expect(queryByRole(statusRole)).not.toBeInTheDocument();
       expect(getByTestId(successBoxId)).toBeInTheDocument();
      expect(queryByText(errorTitle)).not.toBeInTheDocument();
    });
  });
  it('shows loading spinner during registration and hides it after completion', async () => {
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
  it('registration with server error: user exist ', async () => {
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
    const { getByTestId, getByText, getByRole, queryByText } = render(
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
      expect(getByRole('heading')).toHaveTextContent(notificationTitle);
      expect(getByTestId(successBoxId)).toBeInTheDocument();
      expect(queryByText(errorTitle)).not.toBeInTheDocument();
    });
  });
  it('should successfully submit the form and update state', async () => {
    const { getByTestId, queryByRole, queryByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(getByTestId(successBoxId)).toBeInTheDocument();
      expect(getByTestId(successBoxId)).toBeVisible();
      expect(queryByRole('alert')).not.toBeInTheDocument();
      expect(queryByText(errorTitle)).not.toBeInTheDocument();
    });
  });
  it('registration with server error: status code 500', async () => {
      const { findByRole } = render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
  });
  it('should handle errors correctly and update state', async () => {
    const { findByRole } = render(
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
    const { getByTestId, queryByRole, queryByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    await waitFor(() => {
      expect(fullNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();

      expect(getByTestId(successBoxId)).toBeInTheDocument();
      expect(getByTestId(successBoxId)).toBeVisible();
      expect(queryByRole('alert')).not.toBeInTheDocument();
      expect(queryByText(errorTitle)).not.toBeInTheDocument();
    });
  });

  it('notification state has success value by default', async () => {
   const {getByTestId, queryByText}= render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    const successBox:HTMLElement = getByTestId(successBoxId);
    const errorBox:HTMLElement|null = queryByText(errorTitle);

    expect(successBox).toBeInTheDocument();
    expect(successBox).not.toBeVisible();
    expect(errorBox).not.toBeInTheDocument();
  });

  it('does not reset the form when notification type is error', async () => {
    const {queryByRole} =render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(fullNameInput.value).not.toBe('');
    expect(emailInput.value).not.toBe('');
    expect(passwordInput.value).not.toBe('');
    expect(privacyCheckbox.checked).toBe(true);

    await waitFor(() => {
      expect(queryByRole('alert')).toBeInTheDocument();
    });
  });
  test.each([
    { fieldKey: 'fullNameInput', value: testInitials,  },
    { fieldKey: 'emailInput', value: testEmail,},
    { fieldKey: 'passwordInput', value: testPassword,  }
  ])('displays validation errors only after touching fields when mode is onTouche', async ({ fieldKey, value }) => {
    const {  queryByText } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    const formElements: GetElementsResult = getFormElements();
    const inputField:HTMLInputElement|HTMLElement = formElements[fieldKey as keyof typeof formElements];

    expect(queryByText(requiredText)).not.toBeInTheDocument();

    fireEvent.blur(inputField);

    await waitFor(() => {
      expect(queryByText(requiredText)).toBeInTheDocument();
    });
    fireEvent.change(inputField, { target: { value } });

    await waitFor(() => {
      expect(queryByText(requiredText)).not.toBeInTheDocument();
    });
  });
});
