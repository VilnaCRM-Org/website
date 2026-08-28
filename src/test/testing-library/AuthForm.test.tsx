import { fireEvent, screen, waitFor } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { t } from 'i18next';

import { env } from '@/config/env';
import { OnSubmitType } from '@/test/testing-library/fixtures/auth-test-helpers';

import {
  testInitials,
  testEmail,
  testPassword,
  fullNameLabel,
  emailLabel,
  passwordLabel,
  confirmPasswordLabel,
} from './constants';
import renderAuthForm from './fixtures/auth-form-helper';
import { checkElementsInDocument, fillForm, getFormElements } from './utils';

const formTitleText: string = t('sign_up.form.heading_main');

const nameInputText: string = t('sign_up.form.name_input.label');
const emailInputText: string = t('sign_up.form.email_input.label');
const passwordInputText: string = t('sign_up.form.password_input.label');

const requiredText: string = t('sign_up.form.email_input.required');
const nameRequired: string = t('sign_up.form.name_input.required');
const emailMissingSymbols: string = t('sign_up.form.email_input.email_format_error');
const passwordErrorLength: string = t('sign_up.form.password_input.error_length');
const passwordTipAltText: string = t('sign_up.form.password_tip.alt');

const statusRole: string = 'status';
const alertRole: string = 'alert';

interface GetElementsResult {
  fullNameInput: HTMLInputElement | null;
  emailInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  confirmPasswordInput: HTMLInputElement | null;
  privacyCheckbox: HTMLInputElement | null;
}

const mockSubmitSuccess: () => OnSubmitType = (): OnSubmitType =>
  jest.fn().mockResolvedValueOnce(undefined);

describe('AuthForm', () => {
  let onSubmit: OnSubmitType;

  beforeEach(() => {
    onSubmit = mockSubmitSuccess();
  });

  it('renders AuthForm component', async () => {
    const { queryByRole, getByAltText, getByText, getByRole } = renderAuthForm();

    const authForm: HTMLElement = getByRole('form');
    const formTitle: HTMLElement = getByText(formTitleText);
    const nameInputLabel: HTMLElement = getByText(nameInputText);
    const emailInputLabel: HTMLElement = getByText(emailInputText);
    const passwordInputLabel: HTMLElement = getByText(passwordInputText);
    const passwordTipImage: HTMLElement = getByAltText(passwordTipAltText);

    const error: HTMLElement | null = queryByRole(alertRole);
    const loader: HTMLElement | null = queryByRole(statusRole);

    checkElementsInDocument(
      authForm,
      formTitle,
      nameInputLabel,
      emailInputLabel,
      passwordInputLabel,
      passwordTipImage
    );
    await waitFor(() => {
      expect(loader).not.toBeInTheDocument();
      expect(error).not.toBeInTheDocument();
    });
  });
  it('renders input fields', () => {
    renderAuthForm();
    const { fullNameInput, emailInput, passwordInput } = getFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });
  it('correct linkage between inputs and values', async () => {
    renderAuthForm();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm(
      testInitials,
      testEmail,
      testPassword,
      true
    );

    await waitFor(() => {
      expect(emailInput?.value).toBe(testEmail);
      expect(passwordInput?.value).toBe(testPassword);
      expect(fullNameInput?.value).toBe(testInitials);
      expect(privacyCheckbox).toBeChecked();
    });
  });
  it('displays "required" validation message when the input fields are left empty', async () => {
    const { queryByRole, queryAllByText } = renderAuthForm();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = fillForm();

    await waitFor(() => {
      const errorMessage: HTMLElement | null = queryByRole(alertRole);

      expect(fullNameInput?.value).toBe('');
      expect(emailInput?.value).toBe('');
      expect(passwordInput?.value).toBe('');
      expect(privacyCheckbox).not.toBeChecked();

      const requiredError: HTMLElement[] = queryAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(4);
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).not.toBeInTheDocument();
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
      const { queryByText, getByText } = renderAuthForm();

      const formElements: GetElementsResult = getFormElements();
      const inputField: HTMLInputElement | null =
        formElements[fieldKey as keyof typeof formElements];

      if (inputField) await userEvent.clear(inputField);

      await userEvent.tab();

      expect(getByText(requiredText)).toBeInTheDocument();

      if (inputField) fireEvent.change(inputField, { target: { value } });

      await waitFor(() => {
        expect(queryByText(requiredText)).not.toBeInTheDocument();
      });
    }
  );

  it('should have default values', () => {
    renderAuthForm();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    expect(fullNameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');
    expect(privacyCheckbox).not.toBeChecked();
  });
  it('should have correct values', () => {
    renderAuthForm();

    const { fullNameInput, emailInput, passwordInput, privacyCheckbox } = getFormElements();

    if (fullNameInput) fireEvent.change(fullNameInput, { target: { value: testInitials } });
    if (emailInput) fireEvent.change(emailInput, { target: { value: testEmail } });
    if (passwordInput) fireEvent.change(passwordInput, { target: { value: testPassword } });
    if (privacyCheckbox) fireEvent.click(privacyCheckbox);

    expect(fullNameInput).toHaveValue(testInitials);
    expect(emailInput).toHaveValue(testEmail);
    expect(passwordInput).toHaveValue(testPassword);
    expect(privacyCheckbox).toBeChecked();
  });
  it('onSubmit have been called after registration', async () => {
    const { queryByRole } = renderAuthForm({ onSubmit });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        Email: testEmail,
        FullName: testInitials,
        Password: testPassword,
        Privacy: true,
      });
    });

    expect(queryByRole('alert')).not.toBeInTheDocument();
  });
  it('check onTouched mode', async () => {
    const user: UserEvent = userEvent.setup();
    const { getAllByText } = renderAuthForm();

    const { fullNameInput, emailInput, passwordInput, confirmPasswordInput } = getFormElements();

    if (fullNameInput) await user.click(fullNameInput);
    if (emailInput) await user.click(emailInput);
    if (passwordInput) await user.click(passwordInput);
    if (confirmPasswordInput) await user.click(confirmPasswordInput);
    await userEvent.tab();

    await waitFor(() => {
      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(4);
    });
  });
  it('should render privacy policy links with the correct URLs', () => {
    const { getAllByRole } = renderAuthForm({ onSubmit });

    const privacyPolicyLink: HTMLElement[] = getAllByRole('link');
    expect(privacyPolicyLink[0]).toHaveAttribute(
      'href',
      env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL
    );
    expect(privacyPolicyLink[1]).toHaveAttribute('href', env.NEXT_PUBLIC_VILNACRM_USE_POLICY_URL);
  });
  it('calls onSubmit with form data when form is submitted', async () => {
    renderAuthForm({ onSubmit, mocks: [] });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
  it('disables form submission when loading is true', () => {
    renderAuthForm({ onSubmit, mocks: [], loading: true });

    const { signUpButton } = getFormElements();

    expect(signUpButton).toBeInTheDocument();
    expect(signUpButton).toBeDisabled();
  });

  // checkbox
  it('should not set error on Privacy checkbox when there are no validation errors', async () => {
    renderAuthForm();
    const { privacyCheckbox } = fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
  it('should mark Privacy checkbox as invalid if other fields are filled, but checkbox is not checked', async () => {
    const { queryByText } = renderAuthForm();
    const { privacyCheckbox, passwordInput, emailInput, fullNameInput } = fillForm(
      testInitials,
      testEmail,
      testPassword,
      false
    );

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
      expect(privacyCheckbox).not.toBeChecked();

      expect(fullNameInput?.checkValidity()).toBe(true);
      expect(emailInput?.checkValidity()).toBe(true);
      expect(passwordInput?.checkValidity()).toBe(true);
      expect(queryByText(requiredText)).not.toBeInTheDocument();
    });
  });
  it('should not mark Privacy checkbox as invalid if other fields are invalid but checkbox was checked', async () => {
    const { getAllByText } = renderAuthForm();
    const { privacyCheckbox } = fillForm('', '', '', true);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(4);
    });
  });
  it('should have isInvalid true for checkbox if it is not checked and other fields are empty', async () => {
    const { getAllByText } = renderAuthForm();
    const { privacyCheckbox } = fillForm('', '', '', false);

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
      expect(privacyCheckbox?.checkValidity()).toBe(true);

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(4);
    });
  });
  it('should have isInvalid true when Privacy checkbox is not checked on submit', async () => {
    const { getAllByText } = renderAuthForm();
    const { signUpButton, privacyCheckbox } = getFormElements();

    if (signUpButton) fireEvent.click(signUpButton);

    await waitFor(() => {
      const ariaInvalid: string | null | undefined = privacyCheckbox?.getAttribute('aria-invalid');
      expect(ariaInvalid).toBe('true');

      const requiredError: HTMLElement[] = getAllByText(requiredText);
      expect(requiredError[0]).toBeInTheDocument();
      expect(requiredError.length).toBe(4);
    });
    expect(privacyCheckbox).toBeInTheDocument();
  });

  it('should pass validation when Privacy checkbox is checked after failing validation', async () => {
    renderAuthForm();
    const { privacyCheckbox } = fillForm(testInitials, testEmail, testPassword, false);

    await waitFor(() => {
      expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
    });

    if (privacyCheckbox) fireEvent.click(privacyCheckbox);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
  // ---------------------------------------------------------------------------
  // Credential-hygiene hardening (#382 F3/F4).
  // ---------------------------------------------------------------------------
  it('exposes every credential field through its own label', () => {
    const { getByLabelText } = renderAuthForm();

    // Before the id was forwarded to the rendered input, none of these
    // resolved: the labels pointed at elements that did not exist.
    checkElementsInDocument(
      getByLabelText(fullNameLabel),
      getByLabelText(emailLabel),
      getByLabelText(passwordLabel),
      getByLabelText(confirmPasswordLabel)
    );
  });

  it('marks the credential fields with the autofill tokens a password manager needs', () => {
    const { getByLabelText } = renderAuthForm();

    expect(getByLabelText(fullNameLabel)).toHaveAttribute('autocomplete', 'name');
    expect(getByLabelText(emailLabel)).toHaveAttribute('autocomplete', 'email');
    expect(getByLabelText(passwordLabel)).toHaveAttribute('autocomplete', 'new-password');
    expect(getByLabelText(confirmPasswordLabel)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('describes the password field with the full policy, not only the tooltip', () => {
    const { getByLabelText, getByText } = renderAuthForm();

    const describedBy: string | null =
      getByLabelText(passwordLabel).getAttribute('aria-describedby');

    expect(describedBy).toContain('password-requirements');
    expect(getByText(t('sign_up.form.password_input.requirements'))).toBeInTheDocument();
  });

  it('blocks submission and reports a mismatched confirmation', async () => {
    renderAuthForm({ onSubmit });

    fillForm(testInitials, testEmail, testPassword, true, `${testPassword}-typo`);

    await waitFor(() => {
      expect(
        screen.getByText(t('sign_up.form.confirm_password_input.error_mismatch'))
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('submits the matching confirmation as part of the client form payload', async () => {
    renderAuthForm({ onSubmit });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        Password: testPassword,
        ConfirmPassword: testPassword,
      });
    });

    expect(
      screen.queryByText(t('sign_up.form.confirm_password_input.error_mismatch'))
    ).not.toBeInTheDocument();
  });

  it('rejects a password that satisfies every rule except lowercase', async () => {
    renderAuthForm({ onSubmit });

    fillForm(testInitials, testEmail, 'PASSWORD1', true);

    await waitFor(() => {
      expect(
        screen.getByText(t('sign_up.form.password_input.error_lowercase'))
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('displays validation errors for incorrect input values and correct for checkbox', async () => {
    const { queryByText } = renderAuthForm();
    const { privacyCheckbox, passwordInput, emailInput, fullNameInput } = getFormElements();

    if (fullNameInput) {
      fireEvent.change(fullNameInput, { target: { value: '' } });
      fireEvent.blur(fullNameInput);
    }
    if (emailInput) {
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);
    }
    if (passwordInput) {
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.blur(passwordInput);
    }

    if (privacyCheckbox) fireEvent.click(privacyCheckbox);

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');

      expect(queryByText(emailMissingSymbols)).toBeInTheDocument();
      expect(queryByText(passwordErrorLength)).toBeInTheDocument();
      expect(queryByText(requiredText)).toBeInTheDocument();
      expect(queryByText(nameRequired)).toBeInTheDocument();
    });
  });
});
