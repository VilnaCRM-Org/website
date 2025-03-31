import { MockedProvider } from '@apollo/client/testing';
import { render, RenderResult, waitFor } from '@testing-library/react';
import React from 'react';
import { Control, FieldErrors, useForm } from 'react-hook-form';

import { getFormElements } from '@/test/testing-library/utils';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../features/landing/types/authentication/form';

const ERROR_BORDER_STYLE: string = 'border: 1px solid #DC3939';

type FormWrapperProps = {
  children: (control: Control<RegisterItem>) => React.ReactElement;
};
const FormWrapper: React.FC<FormWrapperProps> = ({ children }: FormWrapperProps) => {
  const { control } = useForm<RegisterItem>();
  return children(control);
};
const privacyError: FieldErrors<RegisterItem> = {
  Privacy: { message: '', ref: { name: 'Privacy' }, type: 'required' },
};
const mockOnSubmit: jest.Mock = jest.fn();
const mockHandleSubmit: jest.Mock = jest.fn().mockResolvedValueOnce(undefined);

const RenderAuthComponent: (errors: FieldErrors<RegisterItem>) => RenderResult = (
  errors: FieldErrors<RegisterItem>
) =>
  render(
    <MockedProvider mocks={[]} addTypename={false}>
      <FormWrapper>
        {control => (
          <AuthForm
            errorDetails=""
            onSubmit={mockOnSubmit}
            handleSubmit={mockHandleSubmit}
            errors={errors}
            control={control}
          />
        )}
      </FormWrapper>
    </MockedProvider>
  );

describe('Checkbox', () => {
  it('has checkbox error', () => {
    RenderAuthComponent(privacyError);

    const { privacyCheckbox } = getFormElements();

    expect(privacyCheckbox).toHaveAttribute('aria-invalid', 'true');
  });
  it('does not show error when Privacy checkbox is valid', () => {
    RenderAuthComponent({});
    const { privacyCheckbox } = getFormElements();

    expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
  });
  it('sets isInvalid correctly when Privacy error exists', async () => {
    RenderAuthComponent(privacyError);

    const { privacyCheckbox } = getFormElements();

    await waitFor(() => {
      expect(privacyCheckbox).toHaveStyle(ERROR_BORDER_STYLE);
    });
  });
  it('does not set isInvalid when Privacy error does not exist', async () => {
    RenderAuthComponent({});
    const { privacyCheckbox } = getFormElements();

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveStyle(ERROR_BORDER_STYLE);
    });
  });
  it('does not set isInvalid when Privacy error exists but ref is missing', async () => {
    const privacyErrorWithoutRef: FieldErrors<RegisterItem> = {
      Privacy: { message: '', type: 'required' },
    };

    RenderAuthComponent(privacyErrorWithoutRef);
    const { privacyCheckbox } = getFormElements();

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
  it('does not break when errors is undefined', async () => {
    RenderAuthComponent({} as FieldErrors<RegisterItem>);

    const { privacyCheckbox } = getFormElements();

    await waitFor(() => {
      expect(privacyCheckbox).not.toHaveAttribute('aria-invalid');
    });
  });
});
