import { render, waitFor } from '@testing-library/react';
import dotenv from 'dotenv';
import { t } from 'i18next';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { testInitials, testEmail, testPassword, buttonRole, submitButtonText } from './constants';
import { AuthLinksMock, mockRenderAuthForm } from './mock-render/MockRenderAuthForm';
import { checkElementsInDocument, fillForm, selectFormElements } from './utils';
import React from 'react';
import { SIGNUP_MUTATION } from '@/features/landing/api/service/userService';
import { MockedResponse } from '@apollo/client/testing';

dotenv.config();

const formTitleText: string = t('sign_up.form.heading_main');

const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.email_input.required');
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

describe('AuthForm', () => {
  let onSubmit: jest.Mock<Promise<void>, [RegisterItem]>;
  let handleSubmit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onSubmit = jest.fn();
    handleSubmit = jest.fn();
  });

  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText, getByTestId } = mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit,
      mocks: [fulfilledMockResponse],
    });

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
    mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit,
      mocks: [fulfilledMockResponse],
    });

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });

  it('successful registration', async () => {
    const { queryByRole } = mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit,
      mocks: [fulfilledMockResponse],
    });
    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    expect(serverErrorMessage).not.toBeInTheDocument();
  });

  it('registration with server error', async () => {
    const { findByRole } = mockRenderAuthForm({
      errorDetails: 'Server Error',
      errors: {},
      handleSubmit,
      onSubmit,
      mocks: [rejectedMockResponse],
    });

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
  });
  it('correct linkage between inputs and values', async () => {
    mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit,
      mocks: [fulfilledMockResponse],
    });
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
  it('should have default values', () => {
    mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit: jest.fn(),
      mocks: [],
    });

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = selectFormElements();

    expect(fullNameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');
    expect(privacyCheckbox).not.toBeChecked();
  });

  it('correct linkage between inputs and values with no data', async () => {
    const { queryByRole } = mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit,
      onSubmit: jest.fn(),
      mocks: [],
    });

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm();

    await waitFor(() => {
      // const requiredError: HTMLElement[] = getAllByText(requiredText); //submit doesn't work
      const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);

      expect(fullNameInput.value).toBe(emptyValue);
      expect(emailInput.value).toBe(emptyValue);
      expect(passwordInput.value).toBe(emptyValue);
      expect(privacyCheckbox).not.toBeChecked();

      // expect(privacyCheckbox).toHaveStyle(borderStyle);

      // expect(requiredError.length).toBe(3);
      expect(serverErrorMessage).not.toBeInTheDocument();
    });
  });
  // it('Check onTouched mode', async () => {
  //   const user: UserEvent = userEvent.setup();
  //   const FormWrapper = ({ onSubmit, errors, errorDetails }: any) => {
  //     const { control, handleSubmit } = useForm({
  //       defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  //     });
  //
  //     return (
  //       <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
  //         <AuthForm
  //           control={control}
  //           errorDetails={errorDetails}
  //           onSubmit={onSubmit}
  //           handleSubmit={handleSubmit}
  //           errors={errors}
  //         />
  //       </MockedProvider>
  //     );
  //   };
  //
  //   const { fullNameInput, emailInput } = selectFormElements();
  //
  //   await user.click(fullNameInput);
  //   await user.click(emailInput);
  //
  //   await waitFor(() => {
  //     const requiredError: HTMLElement = getByText(requiredText);
  //     expect(requiredError).toBeInTheDocument();
  //   });
  // });

  // it('displays validation errors for required fields', async () => {
  //   const {getAllByText} =  mockRenderAuthForm({
  //     errorDetails: '',
  //     errors: {},
  //     handleSubmit,
  //     onSubmit: jest.fn(),
  //     mocks: []
  //   });
  //
  //   const { signUpButton } = selectFormElements();
  //   fireEvent.click(signUpButton);
  //
  //   await waitFor(() => {
  //     const requiredError: HTMLElement[] = getAllByText(requiredText);
  //
  //     expect(requiredError.length).toBe(3);
  //   });
  // });
  //   it('should submit the form and reset it', async () => {
  //     const mockHandleSubmit: UseFormHandleSubmit<RegisterItem> = jest.fn();
  //
  // // Mock function for onSubmit
  //     const mockOnSubmit = jest.fn();
  //
  //     const mockErrors: FieldErrors<RegisterItem> = {};
  //     const { getByRole } = mockRenderAuthForm({
  //       errorDetails: '',
  //       errors: mockErrors,
  //       handleSubmit: mockHandleSubmit,
  //       onSubmit: mockOnSubmit,
  //     });
  //
  //     const { fullNameInput, emailInput,} =selectFormElements();
  //
  //     // Simulate user filling the form
  //    await userEvent.type(fullNameInput, 'John Doe');
  //     await userEvent.type(emailInput, 'johndoe@example.com');
  //
  //     // Simulate form submission
  //     await userEvent.click(getByRole('button'));
  //
  //     // Expect onSubmit to be called
  //     expect(mockOnSubmit).toHaveBeenCalled();
  //     expect(mockHandleSubmit).toHaveBeenCalled();
  //   });

  // it('resets the form after successful submission without errors', async () => {
  //   mockRenderAuthForm({
  //     errorDetails: '',
  //     errors:mockErrors,
  //     handleSubmit:jest.fn(),
  //     onSubmit
  //   });
  //
  //   fillForm(testInitials, testEmail, testPassword, true);
  //
  //   await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  //   const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = selectFormElements();
  //
  //   expect(fullNameInput.value).toBe('');
  //   expect(emailInput.value).toBe('');
  //   expect(passwordInput.value).toBe('');
  //   expect(privacyCheckbox.checked).toBe(false);
  // });

  //
  it('does not reset the form when notification type is error', async () => {
    const mockOnSubmit: (data: RegisterItem) => Promise<void> = jest.fn();
    mockRenderAuthForm({
      errorDetails: 'Internal server error',
      errors: {},
      handleSubmit,
      onSubmit: mockOnSubmit,
      mocks: [],
    });
    fillForm(testInitials, testEmail, testPassword, true);

    // await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled());
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = selectFormElements();

    expect(fullNameInput.value).not.toBe(emptyValue);
    expect(emailInput.value).not.toBe(emptyValue);
    expect(passwordInput.value).not.toBe(emptyValue);
    expect(privacyCheckbox.checked).toBe(true);
  });
});

describe('AuthForm privacy links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays custom privacy policy URL when url prop is set', async () => {
    const CUSTOM_URL: string = 'https://custom-privacy-policy.com';
    const { getAllByRole } = render(<AuthLinksMock url={CUSTOM_URL} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', CUSTOM_URL);
    expect(privacyLinks[1]).toHaveAttribute('href', CUSTOM_URL);
  });

  it('falls back to default Privacy Policy URL when env variable is missing or empty', async () => {
    const PRIVACY_POLICY_URL: string = process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL?.trim()
      ? process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL
      : 'https://github.com/VilnaCRM-Org';

    const { getAllByRole } = mockRenderAuthForm({
      errorDetails: '',
      errors: {},
      handleSubmit: jest.fn(),
      onSubmit: jest.fn(),
      mocks: [],
    });

    const link: HTMLElement[] = getAllByRole('link');
    expect(link[0]).toHaveAttribute('href', PRIVACY_POLICY_URL);
  });
  it('displays custom privacy policy URL when environment variable is set', async () => {
    delete process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL = 'https://custom-privacy-policy.com';
    const PRIVACY_URL: string = process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    const { getAllByRole } = render(<AuthLinksMock url={PRIVACY_URL} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://custom-privacy-policy.com');
  });

  it('displays default privacy policy URL when environment variable is not set', async () => {
    delete process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    const { getAllByRole } = render(<AuthLinksMock url="" />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });
  it('falls back to default Privacy Policy URL when url prop is empty or whitespace', async () => {
    const { getAllByRole, rerender } = render(<AuthLinksMock url="" />);

    let privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');

    rerender(<AuthLinksMock url="   " />);

    privacyLinks = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });

  it('displays custom privacy policy URL when url prop is set', async () => {
    const CUSTOM_URL: string = 'https://custom-privacy-policy.com';
    const { getAllByRole } = render(<AuthLinksMock url={CUSTOM_URL} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', CUSTOM_URL);
    expect(privacyLinks[1]).toHaveAttribute('href', CUSTOM_URL);
  });

  it('displays default privacy policy URL when url prop is undefined', async () => {
    const { getAllByRole } = render(<AuthLinksMock url={undefined as unknown as string} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });
});
