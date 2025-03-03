import {fireEvent, render, waitFor} from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import dotenv from 'dotenv';
import { t } from 'i18next';

import { RegisterItem } from '../../features/landing/types/authentication/form';

import { testInitials, testEmail, testPassword } from './constants';
import {AuthLinksMock, mockRenderAuthForm} from './mock-render/MockRenderAuthForm';
import { checkElementsInDocument, fillForm, selectFormElements } from './utils';


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


describe('AuthForm', () => {
  let mockOnSubmit: jest.Mock<Promise<void>, [RegisterItem]>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit = jest.fn();
  });

  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText, getByTestId } = mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
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
    mockRenderAuthForm({ errorDetails: '', notificationType: 'success', mockOnSubmit });

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });

  it('correct linkage between inputs and values', async () => {
    mockRenderAuthForm({ errorDetails: '', notificationType: 'success', mockOnSubmit });

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
    const { getAllByText, queryByRole } = mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
    });

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
    const { getByText } = mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
    });

    const { fullNameInput, emailInput } = selectFormElements();

    await user.click(fullNameInput);
    await user.click(emailInput);

    await waitFor(() => {
      const requiredError: HTMLElement = getByText(requiredText);
      expect(requiredError).toBeInTheDocument();
    });
  });

  test('resets the form after successful submission without errors', async () => {
    mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled());
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = selectFormElements();

    expect(fullNameInput.value).toBe('');
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
    expect(privacyCheckbox.checked).toBe(false);
  });

  test('displays validation errors for required fields', async () => {
    const { getAllByText } = mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'error',
      mockOnSubmit,
    });

    const { signUpButton } = selectFormElements();
    fireEvent.click(signUpButton);

    await waitFor(() => {
      const requiredError: HTMLElement[] = getAllByText(requiredText);

      expect(requiredError.length).toBe(3);
    });
  });

  test('does not reset the form when notification type is error', async () => {
    mockRenderAuthForm({ errorDetails: '', notificationType: 'error', mockOnSubmit });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled());
    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = selectFormElements();

    expect(fullNameInput.value).not.toBe(emptyValue);
    expect(emailInput.value).not.toBe(emptyValue);
    expect(passwordInput.value).not.toBe(emptyValue);
    expect(privacyCheckbox.checked).toBe(true);
  });
});


describe('AuthForm privacy links', () => {
  let mockOnSubmit: jest.Mock<Promise<void>, [RegisterItem]>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit = jest.fn();
  });

  test('displays custom privacy policy URL when url prop is set', async () => {
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
      notificationType: 'success',
      mockOnSubmit,
    });

    const link: HTMLElement[] = getAllByRole('link');
    expect(link[0]).toHaveAttribute('href', PRIVACY_POLICY_URL);
  });
  test('displays custom privacy policy URL when environment variable is set', async () => {
    delete process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL = 'https://custom-privacy-policy.com';
    const PRIVACY_URL:string =process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    const { getAllByRole } = render(<AuthLinksMock url={PRIVACY_URL}/>);


    const privacyLinks:HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://custom-privacy-policy.com');

  });

  test('displays default privacy policy URL when environment variable is not set', async () => {
    delete process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL;

    const { getAllByRole } = render(<AuthLinksMock  url=''/>);

    const privacyLinks:HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });
  test('falls back to default Privacy Policy URL when url prop is empty or whitespace', async () => {
    const { getAllByRole, rerender } = render(<AuthLinksMock url="" />);

    let privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');

    rerender(<AuthLinksMock url="   " />);

    privacyLinks = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });

  test('displays custom privacy policy URL when url prop is set', async () => {
    const CUSTOM_URL :string= 'https://custom-privacy-policy.com';
    const { getAllByRole } = render(<AuthLinksMock url={CUSTOM_URL} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', CUSTOM_URL);
    expect(privacyLinks[1]).toHaveAttribute('href', CUSTOM_URL);
  });

  test('displays default privacy policy URL when url prop is undefined', async () => {
    const { getAllByRole } = render(<AuthLinksMock url={undefined as unknown as string} />);

    const privacyLinks: HTMLElement[] = getAllByRole('link');
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://github.com/VilnaCRM-Org');
  });
});
