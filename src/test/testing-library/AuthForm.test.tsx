import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { testInitials, testEmail, testPassword, buttonRole, submitButtonText } from './constants';
import {
  checkElementsInDocument,
  fillForm,
  getFormElements,
  mockInternalServerErrorResponse,
} from './utils';

const formTitleText: string = t('sign_up.form.heading_main');

const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.email_input.required');
const passwordTipAltText: string = t('sign_up.form.password_tip.alt');

const statusRole: string = 'status';
const alertRole: string = 'alert';

interface AuthFormWrapperProps {
  onSubmit: (data: RegisterItem) => Promise<void>;
  errorDetails: string;
}
interface GetElementsResult {
  fullNameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  privacyCheckbox: HTMLInputElement;
  signUpButton: HTMLElement;
}

function AuthFormWrapper({ errorDetails, onSubmit }: AuthFormWrapperProps): React.ReactElement {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });

  return (
    <AuthForm
      errorDetails={errorDetails}
      onSubmit={onSubmit}
      handleSubmit={handleSubmit}
      errors={errors}
      control={control}
    />
  );
}
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

type OnSubmitType = jest.Mock<Promise<void>, [RegisterItem]>;

const renderAuthFormWithSuccess: (
  onSubmit?: OnSubmitType,
  errorDetails?: string
) => RenderResult = (onSubmit, errorDetails = ''): RenderResult => {
  const mockOnSubmit: OnSubmitType = jest.fn().mockResolvedValueOnce(undefined);

  return render(
    <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
      <AuthFormWrapper errorDetails={errorDetails} onSubmit={onSubmit || mockOnSubmit} />
    </MockedProvider>
  );
};

describe('AuthForm', () => {
  let onSubmit: jest.Mock<Promise<void>, [RegisterItem]>;

  beforeEach(() => {
    onSubmit = jest.fn().mockResolvedValueOnce(undefined);
  });

  it('renders AuthForm component', () => {
    const { queryByRole, getByAltText, getByText, getByRole } = renderAuthFormWithSuccess();

    const authForm: HTMLElement = getByRole('form');
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
    renderAuthFormWithSuccess();
    const { fullNameInput, emailInput, passwordInput } = getFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });
  it('correct linkage between inputs and values', async () => {
    renderAuthFormWithSuccess();

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
  it('displays "required" validation message when the input fields are left empty', async () => {
    const { queryByRole, queryAllByText } = renderAuthFormWithSuccess();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm();

    await waitFor(() => {
      const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);

      expect(fullNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(passwordInput.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();

      const requiredError: HTMLElement[] = queryAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
      expect(serverErrorMessage).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  test.each([
    { fieldKey: 'fullNameInput', value: testInitials },
    { fieldKey: 'emailInput', value: testEmail },
    { fieldKey: 'passwordInput', value: testPassword },
  ])(
    'should display and remove required validation message for %s',
    async ({ fieldKey, value }) => {
      const { queryByText, getByText } = renderAuthFormWithSuccess();

      const formElements: GetElementsResult = getFormElements();
      const inputField: HTMLInputElement | HTMLElement =
        formElements[fieldKey as keyof typeof formElements];

      await userEvent.clear(inputField);
      await userEvent.tab();

      expect(getByText(requiredText)).toBeInTheDocument();

      fireEvent.change(inputField, { target: { value } });

      await waitFor(() => {
        expect(queryByText(requiredText)).not.toBeInTheDocument();
      });
    }
  );

  it('should have default values', () => {
    renderAuthFormWithSuccess();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(fullNameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');
    expect(privacyCheckbox).not.toBeChecked();
  });
  it('onSubmit have been called after registration', async () => {
    const { queryByRole } = renderAuthFormWithSuccess(onSubmit);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        Email: testEmail,
        FullName: testInitials,
        Password: testPassword,
        Privacy: true,
      });
    });

    expect(queryByRole('alert')).not.toBeInTheDocument();
  });
  it('should show error alert', () => {
    const { queryByRole } = render(
      <MockedProvider mocks={[mockInternalServerErrorResponse]} addTypename={false}>
        <AuthFormWrapper errorDetails="Internal Server Error." onSubmit={onSubmit} />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    const alert: HTMLElement | null = queryByRole('alert');

    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Internal Server Error');
  });
  it('check onTouched mode', async () => {
    const user: UserEvent = userEvent.setup();
    const { getAllByText } = renderAuthFormWithSuccess();

    const { fullNameInput, emailInput, passwordInput } = getFormElements();

    await user.click(fullNameInput);
    await user.click(emailInput);
    await user.click(passwordInput);
    await userEvent.tab();

    await waitFor(() => {
      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
    });
  });
  it('should render privacy policy links with the correct URLs', () => {
    const { getAllByRole } = renderAuthFormWithSuccess(onSubmit, 'Internal Server Error.');

    const privacyPolicyLink: HTMLElement[] = getAllByRole('link');
    const expectedUrl: string =
      process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || 'https://github.com/VilnaCRM-Org';
    expect(privacyPolicyLink[0]).toHaveAttribute('href', expectedUrl);
    expect(privacyPolicyLink[1]).toHaveAttribute('href', expectedUrl);
  });

  // checkbox
  it('should not set error on Privacy checkbox when there are no validation errors', async () => {
    renderAuthFormWithSuccess();
    const { privacyCheckbox } = fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
  it('should mark Privacy checkbox as invalid if other fields are filled, but checkbox is not checked', async () => {
    const { queryByText } = renderAuthFormWithSuccess();
    const { privacyCheckbox } = fillForm(testInitials, testEmail, testPassword, false);

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');

      expect(queryByText(requiredText)).not.toBeInTheDocument();
    });
  });
  it('should not mark Privacy checkbox as invalid if other fields are invalid but checkbox was checked', async () => {
    const { getAllByText } = renderAuthFormWithSuccess();
    const { privacyCheckbox } = fillForm('', '', '', true);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
    });
  });
  it('should have isInvalid true for checkbox if it is not checked and other fields are empty', async () => {
    const { getAllByText } = renderAuthFormWithSuccess();
    const { privacyCheckbox } = fillForm('', '', '', false);

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
    });
  });
  it('should have isInvalid true when Privacy checkbox is not checked on submit', async () => {
    const { getAllByText } = renderAuthFormWithSuccess();
    const { signUpButton, privacyCheckbox } = getFormElements();

    fireEvent.click(signUpButton);

    await waitFor(() => {
      const ariaInvalid: string | null = privacyCheckbox.getAttribute('aria-invalid');
      expect(ariaInvalid).toBe('true');

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(3);
    });
    expect(privacyCheckbox).toBeInTheDocument();
  });

  it('should pass validation when Privacy checkbox is checked after failing validation', async () => {
    renderAuthFormWithSuccess();
    const { privacyCheckbox } = fillForm(testInitials, testEmail, testPassword, false);
    const signUpButton: HTMLElement = screen.getByRole(buttonRole, { name: submitButtonText });
    fireEvent.click(signUpButton);

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
    });

    fireEvent.click(privacyCheckbox);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
});
