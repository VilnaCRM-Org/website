import { waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import dotenv from 'dotenv';
import { t } from 'i18next';

import { RegisterItem } from '../../features/landing/types/authentication/form';

import { testInitials, testEmail, testPassword } from './constants';
import { renderAuthForm } from './renderAuthForm';
import { checkElementsInDocument, fillForm, selectFormElements } from './utils';

dotenv.config();

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

describe('AuthForm', () => {
  let mockOnSubmit: jest.Mock<Promise<void>, [RegisterItem]>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSubmit = jest.fn();
  });

  it('renders AuthForm component', () => {
    const { container, queryByRole, getByAltText, getByText, getByTestId } = renderAuthForm({
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
    renderAuthForm({ errorDetails: '', notificationType: 'success', mockOnSubmit });

    const { fullNameInput, emailInput, passwordInput } = selectFormElements();

    checkElementsInDocument(fullNameInput, emailInput, passwordInput);
  });
  it('falls back to default Privacy Policy URL when env variable is missing or empty', async () => {
    const PRIVACY_POLICY_URL: string = process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL?.trim()
      ? process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL
      : 'https://github.com/VilnaCRM-Org';

    const { getAllByRole } = renderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
    });

    const link: HTMLElement[] = getAllByRole('link');
    expect(link[0]).toHaveAttribute('href', PRIVACY_POLICY_URL);
  });
  it('correct linkage between inputs and values', async () => {
    renderAuthForm({ errorDetails: '', notificationType: 'success', mockOnSubmit });

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
    const { getAllByText, queryByRole } = renderAuthForm({
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
    const { getByText } = renderAuthForm({
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
});
