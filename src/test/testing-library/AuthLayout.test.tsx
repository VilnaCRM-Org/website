import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import React, { AriaRole, Dispatch } from 'react';

import { CreateUserInput } from '@/test/apollo-server/types';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
import AuthLayout from '../../features/landing/components/AuthSection/AuthForm';
import { NotificationType } from '../../features/landing/components/Notification/types';

import {
  buttonRole,
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
const checkboxRole: AriaRole = 'checkbox';

const formTitleText: string = t('sign_up.form.heading_main');
const successTitleText: string = t('notifications.success.title');
const confettiAltText: string = t('notifications.success.images.confetti');
const confettiBottomAltText: string = t('notifications.success.images.confetti-bottom');
const successBackButton: string = t('notifications.success.button');
const requiredText: string = t('sign_up.form.email_input.required');
const errorTitleText: string = t('notifications.error.title');
const retryTextButton: string = t('notifications.error.retry_button');

const fulfilledMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: variables => {
    const { input } = variables;
    return !!input?.email && !!input?.initials && !!input?.password;
  },

  result: variables => {
    const { input } = variables;
    const { initials, email, clientMutationId } = input;

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId,
        },
      },
    };
  },
};

class ServerError extends Error {
  public statusCode: number = 500;

  constructor(message = 'Network error') {
    super(message);
    this.name = 'ServerError';
  }
}

const networkError: Error = new ServerError();

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
    error: networkError,
  },
  fulfilledMockResponse,
];
interface GetElementsResult {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
  signUpButton: HTMLElement;
}
const inputFields: { fieldKey: string; value: string }[] = [
  { fieldKey: 'fullNameInput', value: testInitials },
  { fieldKey: 'emailInput', value: testEmail },
  { fieldKey: 'passwordInput', value: testPassword },
];

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
    const { getByRole, queryByRole, queryByText, getByText } = render(
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
      expect(getByText(successTitleText)).toBeInTheDocument();
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('should pass correct data to the mutation', async () => {
    const mockVariableMatcher: jest.Mock<boolean, [{ input: CreateUserInput }]> = jest
      .fn()
      .mockReturnValue(true);

    const mockWithVariableCapture: typeof fulfilledMockResponse & {
      variableMatcher: jest.Mock<boolean, [{ input: CreateUserInput }]>;
    } = {
      ...fulfilledMockResponse,
      variableMatcher: mockVariableMatcher,
    };

    render(
      <MockedProvider mocks={[mockWithVariableCapture]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(mockVariableMatcher).toHaveBeenCalled();
      const capturedVariables: { input: CreateUserInput } = mockVariableMatcher.mock.calls[0][0];
      const { input } = capturedVariables;

      expect(input).not.toBeUndefined();
      expect(input.initials).toBe(testInitials);
      expect(input.email).toBe(testEmail);
      expect(input.password).toBe(testPassword);
      expect(input.clientMutationId).toBe('132');
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

    await waitFor(() => {
      expect(queryByRole('status')).not.toBeInTheDocument();
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
    const { getByText, getByRole, queryByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const notificationTitle: HTMLElement = getByText(formTitleText);
      const notificationBox: HTMLElement | null | undefined =
        notificationTitle.parentElement?.parentElement?.parentElement;

      expect(notificationBox).toBeInTheDocument();
      expect(notificationBox).toBeVisible();
      expect(notificationTitle).toBeInTheDocument();
      expect(getByRole('heading')).toHaveTextContent(successTitleText);
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('should successfully submit the form and update state', async () => {
    const { queryByRole, queryByText, getByText } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const successTitle: HTMLElement = getByText(successTitleText);
      expect(successTitle).toBeInTheDocument();
      expect(successTitle).toBeVisible();
      expect(queryByRole('alert')).not.toBeInTheDocument();
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('registration with server error: status code 500', async () => {
    const { findByText } = render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const errorTitle: HTMLElement = await findByText(errorTitleText);
    expect(errorTitle).toBeInTheDocument();
  });
  it('should successfully retry submission after a 500 error', async () => {
    const { findByText, getByText, queryByRole } = render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });

    const errorTitle: HTMLElement = await findByText(errorTitleText);
    expect(errorTitle).toBeInTheDocument();

    const retryButton: HTMLElement = await findByText(retryTextButton);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });

    await waitFor(() => {
      const successTitle: HTMLElement = getByText(successTitleText);

      expect(successTitle).toBeInTheDocument();
      expect(successTitle).toBeVisible();
    });
  });
  it('should handle alert errors correctly and update state', async () => {
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
    const { getByText, queryByRole, queryByText } = render(
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

      const successTitle: HTMLElement = getByText(successTitleText);
      expect(successTitle).toBeInTheDocument();
      expect(successTitle).toBeVisible();
      expect(queryByRole('alert')).not.toBeInTheDocument();
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });

  it('notification state has success value by default', async () => {
    const { getByText, queryByText } = render(
      <MockedProvider mocks={internalServerErrorResponse} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    const successTitle: HTMLElement = getByText(successTitleText);
    const errorBox: HTMLElement | null = queryByText(errorTitleText);

    expect(successTitle).toBeInTheDocument();
    expect(successTitle).not.toBeVisible();
    expect(errorBox).not.toBeInTheDocument();
  });

  it('does not reset the form when notification type is error', async () => {
    const { findByText } = render(
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

    const errorBox: HTMLElement = await findByText(errorTitleText);
    expect(errorBox).toBeInTheDocument();
  });
  test.each(inputFields)(
    'displays validation errors only after touching fields when mode is onTouche',
    async ({ fieldKey, value }) => {
      const { queryByText } = render(
        <MockedProvider mocks={[]} addTypename={false}>
          <AuthLayout />
        </MockedProvider>
      );

      const formElements: GetElementsResult = getFormElements();
      const inputField: HTMLInputElement | HTMLElement =
        formElements[fieldKey as keyof typeof formElements];

      expect(queryByText(requiredText)).not.toBeInTheDocument();

      fireEvent.blur(inputField);

      await waitFor(() => {
        expect(queryByText(requiredText)).toBeInTheDocument();
      });
      fireEvent.change(inputField, { target: { value } });

      await waitFor(() => {
        expect(queryByText(requiredText)).not.toBeInTheDocument();
      });
    }
  );
  it('should show success notification after successful form submission and hide it after clicking back', async () => {
    const { queryByAltText, getByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByAltText(confettiAltText)).toBeInTheDocument();
      expect(queryByAltText(confettiAltText)).toBeVisible();
      expect(queryByAltText(confettiBottomAltText)).toBeInTheDocument();
      expect(queryByAltText(confettiBottomAltText)).toBeVisible();
    });

    const backButton: HTMLElement = getByRole('button', { name: successBackButton });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toBeVisible();

    backButton.click();

    await waitFor(() => {
      expect(queryByAltText(confettiAltText)).not.toBeVisible();
      expect(queryByAltText(confettiBottomAltText)).not.toBeVisible();
    });
  });

  it('should initialize notificationType with "success" value', () => {
    const mockSetNotificationType: jest.Mock<void> = jest.fn();
    const useStateSpy: jest.SpyInstance<[unknown, Dispatch<unknown>], [], NotificationType> = jest
      .spyOn(React, 'useState')
      .mockImplementationOnce(
        () => ['success', mockSetNotificationType] as [NotificationType, jest.Mock]
      );

    render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    const initialState: undefined = useStateSpy.mock.results[0]?.value?.[0];

    expect(initialState).toBe('success');

    useStateSpy.mockRestore();
  });
  it('should initialize with success notification state', () => {
    const { getByText, queryByText } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    const successTitle: HTMLElement = getByText(successTitleText);
    expect(successTitle).toBeInTheDocument();
    expect(successTitle).not.toBeVisible();

    expect(queryByText(errorTitleText)).not.toBeInTheDocument();
  });
  it('handles maximum length and special character inputs', async () => {
    const longName: string = 'A'.repeat(50);
    const specialCharsEmail: string = 'test.user+special@example.com';
    const complexPassword: string = 'P@$$w0rd!*&^%';

    const specialCharsMock: MockedResponse = {
      ...fulfilledMockResponse,
      result: () => ({
        data: {
          createUser: {
            user: {
              email: specialCharsEmail,
              initials: longName,
              id: 0,
              confirmed: true,
            },
            clientMutationId: '132',
          },
        },
      }),
    };

    const { getByText } = render(
      <MockedProvider mocks={[specialCharsMock]} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(longName, specialCharsEmail, complexPassword, true);

    await waitFor(() => {
      expect(getByText(successTitleText)).toBeInTheDocument();
    });
  });
});
