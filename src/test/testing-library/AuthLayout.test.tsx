import { MockedResponse } from '@apollo/client/testing';
import { fireEvent, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import { AriaRole } from 'react';

import { ClientErrorMessages, getClientErrorMessages } from '@/shared/clientErrorMessages';
import { CreateUserInput } from '@/test/apollo-server/types';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';

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
  fulfilledMockResponse,
  mockInternalServerErrorResponse,
  mockNetworkErrorAndSuccessResponses,
  mockUserExistsErrorResponse,
  renderAuthLayout,
} from './fixtures/auth-test-helpers';
import { NETWORK_FAILURE } from './fixtures/errors';
import { fillForm, getFormElements, GetElementsResult } from './utils';

const statusRole: string = 'status';
const alertRole: string = 'alert';
const checkboxRole: AriaRole = 'checkbox';

const formTitleText: string = t('sign_up.form.heading_main');
const successTitleText: string = t('notifications.success.title');
const confettiAltText: string = t('notifications.success.images.confetti');
const successBackButton: string = t('notifications.success.button');
const requiredText: string = t('sign_up.form.email_input.required');
const errorTitleText: string = t('notifications.error.title');
const retryTextButton: string = t('notifications.error.retry_button');
const emailMissingSymbols: string = t('sign_up.form.email_input.email_format_error');
const emailValidationText: string = t('sign_up.form.email_input.invalid_message');
const passwordErrorLength: string = t('sign_up.form.password_input.error_length');
const passwordErrorNumbers: string = t('sign_up.form.password_input.error_numbers');
const passwordErrorUppercase: string = t('sign_up.form.password_input.error_uppercase');

jest.mock('uuid', () => ({
  v4: jest.fn(() => '132'),
}));

type FormElement = { fieldKey: string; value: string };
const inputFields: FormElement[] = [
  { fieldKey: 'fullNameInput', value: testInitials },
  { fieldKey: 'emailInput', value: testEmail },
  { fieldKey: 'passwordInput', value: testPassword },
];
type ValidationFormElement = FormElement & { errorMessage: string };
const validationInputFields: ValidationFormElement[] = [
  { fieldKey: 'emailInput', value: 'invalid-email', errorMessage: emailMissingSymbols },
  { fieldKey: 'emailInput', value: 'invalid-email@gmail.', errorMessage: emailValidationText },
  { fieldKey: 'passwordInput', value: '123', errorMessage: passwordErrorLength },
  { fieldKey: 'passwordInput', value: 'qwertyui', errorMessage: passwordErrorNumbers },
  { fieldKey: 'passwordInput', value: 'q1wertyui', errorMessage: passwordErrorUppercase },
];

type EdgeCases = { initials: string; email: string; password: string }[];
const edgeCases: EdgeCases = [
  {
    initials: `${'A'.repeat(25)} ${'B'.repeat(24)}`,
    email: 'test.user+special@example.com',
    password: 'P@$$w0rd!*&^%',
  },
];

describe('AuthLayout', () => {
  let messages: ClientErrorMessages;

  beforeEach(() => {
    jest.clearAllMocks();
    messages = getClientErrorMessages();
  });

  it('renders AuthComponent component correctly', () => {
    const { getByText, getByPlaceholderText, getByRole } = renderAuthLayout();

    const formTitle: HTMLElement = getByText(formTitleText);
    expect(formTitle).toBeInTheDocument();
    expect(getByPlaceholderText(fullNamePlaceholder)).toBeInTheDocument();
    expect(getByPlaceholderText(emailPlaceholder)).toBeInTheDocument();
    expect(getByPlaceholderText(passwordPlaceholder)).toBeInTheDocument();
    expect(getByRole(checkboxRole)).toBeInTheDocument();
    expect(getByRole(buttonRole, { name: submitButtonText })).toBeInTheDocument();
  });

  it('renders inputs with correct default values', () => {
    renderAuthLayout();
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(emailInput?.value).toBe('');
    expect(fullNameInput?.value).toBe('');
    expect(passwordInput?.value).toBe('');
    expect(privacyCheckbox?.checked).toBe(false);
  });
  it('displays loader and submits form successfully without errors', async () => {
    const { getByRole, queryByRole, queryByText, getByText } = renderAuthLayout([
      fulfilledMockResponse,
    ]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const loader: HTMLElement = getByRole(statusRole);
      expect(loader).toBeInTheDocument();
    });

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    expect(serverErrorMessage).not.toHaveAttribute('aria-live', 'assertive');

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

    renderAuthLayout([mockWithVariableCapture]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(mockVariableMatcher).toHaveBeenCalled();
      const capturedVariables: { input: CreateUserInput } = mockVariableMatcher.mock.calls[0][0];
      const { input } = capturedVariables;

      expect(input).not.toBeUndefined();
      expect(input.initials).toBe(testInitials);
      expect(input.email).toBe(testEmail.toLowerCase());
      expect(input.password).toBe(testPassword);
      expect(input.clientMutationId).toBe('132');
    });
  });
  it('shows loading spinner during registration and hides it after completion', async () => {
    const { queryByRole } = renderAuthLayout([fulfilledMockResponse]);

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
    const { findByRole, getByPlaceholderText } = renderAuthLayout([mockUserExistsErrorResponse]);

    const email: string = testEmail.toLowerCase();
    fillForm(testInitials, email, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();

    expect(getByPlaceholderText(emailPlaceholder)).toHaveValue(email);
    expect(getByPlaceholderText(passwordPlaceholder)).toHaveValue(testPassword);
  });
  it('should successfully submit the form and update state', async () => {
    const { getByRole, queryByText, getByText } = renderAuthLayout([fulfilledMockResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const successTitle: HTMLElement = getByText(successTitleText);
      const alertBox: HTMLElement | null = getByRole('alert');

      expect(successTitle).toBeInTheDocument();
      expect(successTitle).toBeVisible();
      expect(alertBox).toBeInTheDocument();
      expect(alertBox).not.toHaveAttribute('aria-live', 'assertive');
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('registration with server error: status code 500', async () => {
    const { findByRole, getByText, queryByRole } = renderAuthLayout(
      mockNetworkErrorAndSuccessResponses
    );

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm(
      testInitials,
      testEmail,
      testPassword,
      true
    );
    await findByRole(statusRole);

    await waitFor(() => {
      const errorTitle: HTMLElement = getByText(errorTitleText);
      expect(errorTitle).toBeInTheDocument();
    });

    expect(fullNameInput).toHaveValue(testInitials);
    expect(emailInput).toHaveValue(testEmail);
    expect(passwordInput).toHaveValue(testPassword);
    expect(privacyCheckbox).toBeChecked();

    const retryButton: HTMLElement = getByText(retryTextButton);

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });
  });
  it('should handle alert errors correctly and update state', async () => {
    const { getByRole } = renderAuthLayout([mockInternalServerErrorResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const serverErrorMessage: HTMLElement = getByRole(alertRole);
      expect(serverErrorMessage).toBeInTheDocument();
    });
  });
  it('resets the form after successful submit with no errors', async () => {
    const { getByText, getByRole, queryByText } = renderAuthLayout([fulfilledMockResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

      expect(fullNameInput?.value).toBe('');
      expect(emailInput?.value).toBe('');
      expect(passwordInput?.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();

      const successTitle: HTMLElement = getByText(successTitleText);
      const alertBox: HTMLElement | null = getByRole('alert');

      expect(successTitle).toBeInTheDocument();
      expect(successTitle).toBeVisible();
      expect(alertBox).toBeInTheDocument();
      expect(alertBox).not.toHaveAttribute('aria-live', 'assertive');
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('notification state has success value by default', async () => {
    const { getByText, queryByText } = renderAuthLayout(mockNetworkErrorAndSuccessResponses);

    const successTitle: HTMLElement = getByText(successTitleText);
    const successButton: HTMLElement = getByText(successBackButton);
    const errorBox: HTMLElement | null = queryByText(errorTitleText);

    expect(successTitle).toBeInTheDocument();
    expect(successTitle).not.toBeVisible();
    expect(successButton).toBeInTheDocument();
    expect(successButton).not.toBeVisible();
    expect(errorBox).not.toBeInTheDocument();
  });
  test.each(inputFields)(
    'displays validation errors only after touching fields when mode is onTouche',
    async ({ fieldKey, value }) => {
      const { queryByText } = renderAuthLayout([]);

      const formElements: GetElementsResult = getFormElements();
      const inputField: HTMLInputElement | null =
        formElements[fieldKey as keyof typeof formElements];

      expect(queryByText(requiredText)).not.toBeInTheDocument();

      if (inputField) fireEvent.blur(inputField);

      await waitFor(() => {
        expect(queryByText(requiredText)).toBeInTheDocument();
      });
      if (inputField) fireEvent.change(inputField, { target: { value } });

      await waitFor(() => {
        expect(queryByText(requiredText)).not.toBeInTheDocument();
      });
    }
  );
  test.each(validationInputFields)(
    'displays validation errors for incorrect input values',
    async ({ fieldKey, value, errorMessage }) => {
      const { queryByText } = renderAuthLayout([]);

      const formElements: GetElementsResult = getFormElements();
      const inputField: HTMLInputElement | null =
        formElements[fieldKey as keyof typeof formElements];

      if (inputField) {
        fireEvent.change(inputField, { target: { value } });
        fireEvent.blur(inputField);
      }

      await waitFor(() => {
        expect(queryByText(errorMessage)).toBeInTheDocument();
      });
    }
  );
  test.each(edgeCases)(
    'submits successfully with edge-case inputs',
    async ({ initials, email, password }) => {
      const mocks: MockedResponse[] = [{ ...fulfilledMockResponse, variableMatcher: jest.fn() }];
      const { findByText } = renderAuthLayout(mocks);
      fillForm(initials, email, password, true);
      expect(await findByText(successTitleText)).toBeInTheDocument();
    }
  );

  it('should initialize with empty errorText (no error message visible)', () => {
    const { queryByText } = renderAuthLayout([]);

    const networkErrorElement: HTMLElement | null = queryByText(messages.network);

    expect(networkErrorElement).not.toBeInTheDocument();
  });
  it('should have success state by default when notificationType is "success"', async () => {
    const { getByText } = renderAuthLayout([fulfilledMockResponse]);

    await waitFor(() => {
      const successElement: HTMLElement = getByText(successTitleText);
      expect(successElement).toBeInTheDocument();
    });
  });
});

describe('AuthLayoutWithNotification', () => {
  let messages: ClientErrorMessages;

  beforeEach(() => {
    jest.clearAllMocks();
    messages = getClientErrorMessages();
  });

  it('should successfully retry submission after a 500 error', async () => {
    const { findByText, getByText, queryByRole } = renderAuthLayout(
      mockNetworkErrorAndSuccessResponses
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });

    await waitFor(() => {
      const errorTitle: HTMLElement = getByText(errorTitleText);
      const serverError: HTMLElement = getByText(messages.server_error);

      expect(errorTitle).toBeInTheDocument();
      expect(serverError).toBeInTheDocument();
    });

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

  it('should show success notification after successful form submission and hide it after clicking back', async () => {
    const { queryByAltText, getByRole } = renderAuthLayout([fulfilledMockResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByAltText(confettiAltText)).toBeInTheDocument();
      expect(queryByAltText(confettiAltText)).toBeVisible();
      expect(queryByAltText('')).toBeInTheDocument();
      expect(queryByAltText('')).toBeVisible();
    });

    const backButton: HTMLElement = getByRole('button', { name: successBackButton });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toBeVisible();

    backButton.click();

    await waitFor(() => {
      expect(queryByAltText(confettiAltText)).not.toBeVisible();
      expect(queryByAltText('')).not.toBeVisible();
    });
  });
  it('does not reset the form when notification type is error', async () => {
    const { getByText } = renderAuthLayout([mockInternalServerErrorResponse]);

    fillForm(testInitials, testEmail, testPassword, true);
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(fullNameInput?.value).not.toBe('');
    expect(emailInput?.value).not.toBe('');
    expect(passwordInput?.value).not.toBe('');
    expect(privacyCheckbox?.checked).toBe(true);

    await waitFor(() => {
      const errorBox: HTMLElement = getByText(errorTitleText);
      const serverError: HTMLElement = getByText('Internal Server Error.');

      expect(errorBox).toBeVisible();
      expect(serverError).toBeInTheDocument();
    });
  });
  it('shows success notification after successful authentication', async () => {
    const { getByText, getByRole, queryByText, getByLabelText } = renderAuthLayout([
      fulfilledMockResponse,
    ]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const notificationTitle: HTMLElement = getByText(formTitleText);
      const notificationBox: HTMLElement = getByLabelText('success');

      expect(notificationBox).toBeInTheDocument();
      expect(notificationBox).toBeVisible();
      expect(notificationTitle).toBeInTheDocument();
      expect(getByRole('heading')).toHaveTextContent(successTitleText);
      expect(queryByText(errorTitleText)).not.toBeInTheDocument();
    });
  });
  it('should initialize with success notification state', () => {
    const { getByText, queryByText } = renderAuthLayout([]);

    const successTitle: HTMLElement = getByText(successTitleText);
    expect(successTitle).toBeInTheDocument();
    expect(successTitle).not.toBeVisible();

    expect(queryByText(errorTitleText)).not.toBeInTheDocument();
  });
  it('should display network error text when network error message includes "Failed to fetch"', async () => {
    const failedToFetchMockResponse: MockedResponse = {
      request: {
        query: SIGNUP_MUTATION,
        variables: {
          input: {
            email: testEmail.toLowerCase(),
            initials: testInitials,
            password: testPassword,
            clientMutationId: '132',
          },
        },
      },
      error: NETWORK_FAILURE,
    };

    const { getByText } = renderAuthLayout([failedToFetchMockResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const errorTitle: HTMLElement = getByText(errorTitleText);
      const networkErrorNode: HTMLElement = getByText(messages.network);

      expect(errorTitle).toBeInTheDocument();
      expect(networkErrorNode).toBeInTheDocument();
    });
  });
  it('should initialize with Notification closed and empty errorText', () => {
    const { queryByText, queryByLabelText } = renderAuthLayout([]);

    expect(queryByText(messages.went_wrong)).not.toBeInTheDocument();

    expect(queryByLabelText('error')).not.toBeInTheDocument();
    expect(queryByLabelText('success')).toBeInTheDocument();
  });
});
