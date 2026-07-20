/**
 * Integration coverage: the presentational `AuthForm`.
 *
 * `AuthForm` is a controlled component driven by react-hook-form state passed in
 * from `AuthLayout`. Here it is mounted via a small wrapper that owns a real
 * `useForm` instance and a `MockedProvider` (its children use the Apollo-less
 * UI kit, but the wrapper mirrors the production provider stack). The tests
 * drive every branch: the happy submit path, the loading-disabled button, the
 * privacy-checkbox error branch (`!!formValidationErrors.Privacy`), and the
 * per-field validation messages produced by the real validators.
 */
import { MockedProvider } from '@apollo/client/testing/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '@landing/auth-section/auth-form/auth-form';

import { env } from '../../../../src/config/env';
import { RegisterItem } from '../../../../src/features/landing/types/authentication/form';

interface WrapperProps {
  onSubmit: (data: RegisterItem) => Promise<void>;
  loading: boolean;
}

function AuthFormHarness({ onSubmit, loading }: WrapperProps): React.ReactElement {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { FullName: '', Email: '', Password: '', Privacy: false },
  });

  return (
    <MockedProvider mocks={[]}>
      <AuthForm
        onSubmit={onSubmit}
        handleSubmit={handleSubmit}
        formValidationErrors={errors}
        control={control}
        loading={loading}
      />
    </MockedProvider>
  );
}

const noopSubmit: () => Promise<void> = () => Promise.resolve();

function renderHarness(overrides: Partial<WrapperProps> = {}): ReturnType<typeof render> {
  const { onSubmit = noopSubmit, loading = false } = overrides;
  return render(<AuthFormHarness onSubmit={onSubmit} loading={loading} />);
}

const fullNamePlaceholder: string = t('sign_up.form.name_input.placeholder');
const emailPlaceholder: string = t('sign_up.form.email_input.placeholder');
const passwordPlaceholder: string = t('sign_up.form.password_input.placeholder');
const submitText: string = t('sign_up.form.button_text');

describe('integration: AuthForm', () => {
  it('renders the title, inputs, password tip image and privacy links', () => {
    renderHarness();

    expect(screen.getByText(t('sign_up.form.heading_main'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(fullNamePlaceholder)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(emailPlaceholder)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(passwordPlaceholder)).toBeInTheDocument();
    expect(screen.getByAltText(t('sign_up.form.password_tip.alt'))).toBeInTheDocument();

    const links: HTMLElement[] = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL);
    expect(links[1]).toHaveAttribute('href', env.NEXT_PUBLIC_VILNACRM_USE_POLICY_URL);
  });

  it('disables the submit button while loading', () => {
    renderHarness({ loading: true });

    expect(screen.getByRole('button', { name: submitText })).toBeDisabled();
  });

  it('calls onSubmit with the entered values when the form is valid', async () => {
    const onSubmit: jest.Mock = jest.fn().mockResolvedValue(undefined);
    renderHarness({ onSubmit });

    fireEvent.change(screen.getByPlaceholderText(fullNamePlaceholder), {
      target: { value: 'John Doe' },
    });
    fireEvent.change(screen.getByPlaceholderText(emailPlaceholder), {
      target: { value: 'john@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(passwordPlaceholder), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: submitText }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        FullName: 'John Doe',
        Email: 'john@example.com',
        Password: 'Password123',
        Privacy: true,
      });
    });
  });

  it('marks the privacy checkbox invalid and shows field errors on an empty submit', async () => {
    const onSubmit: jest.Mock = jest.fn().mockResolvedValue(undefined);
    renderHarness({ onSubmit });

    fireEvent.click(screen.getByRole('button', { name: submitText }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
      // FullName, Email and Password each use their own required-message key
      // (name_input/email_input/password_input.required), but all three keys
      // intentionally resolve to the same text ("This field is required"), so a
      // single key's text matches all three rendered error nodes.
      expect(screen.getAllByText(t('sign_up.form.name_input.required'))).toHaveLength(3);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation errors for malformed field values', async () => {
    renderHarness();

    fireEvent.change(screen.getByPlaceholderText(emailPlaceholder), {
      target: { value: 'invalid-email' },
    });
    fireEvent.blur(screen.getByPlaceholderText(emailPlaceholder));
    fireEvent.change(screen.getByPlaceholderText(passwordPlaceholder), {
      target: { value: '123' },
    });
    fireEvent.blur(screen.getByPlaceholderText(passwordPlaceholder));

    await waitFor(() => {
      expect(
        screen.getByText(t('sign_up.form.email_input.email_format_error'))
      ).toBeInTheDocument();
      expect(screen.getByText(t('sign_up.form.password_input.error_length'))).toBeInTheDocument();
    });
  });
});
