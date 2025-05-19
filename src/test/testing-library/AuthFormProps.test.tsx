import { MockedResponse } from '@apollo/client/testing';
import { RenderResult } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { AuthFormWrapperProps, OnSubmitType } from './fixtures/auth-test-helpers';
import { renderWithProviders } from './utils';

function AuthFormWrapper({ onSubmit }: AuthFormWrapperProps): React.ReactElement {
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
      onSubmit={onSubmit}
      handleSubmit={handleSubmit}
      formValidationErrors={errors}
      control={control}
      loading={false}
    />
  );
}
function renderAuthForm({
  onSubmit,
  mocks,
}: {
  mocks?: MockedResponse[];
  onSubmit: OnSubmitType;
}): RenderResult {
  return renderWithProviders(<AuthFormWrapper onSubmit={onSubmit} />, { apolloMocks: mocks });
}

jest.mock('../../features/landing/components/AuthSection/AuthForm/AuthForm', () => ({
  __esModule: true,
  default: jest.fn(() => <form data-testid="auth-form-mock" />),
}));

describe('AuthFormWrapper - Props Forwarding', () => {
  let onSubmit: OnSubmitType;

  beforeEach(() => {
    onSubmit = jest.fn<Promise<void>, [RegisterItem]>().mockResolvedValueOnce(undefined);
  });

  it('forwards props correctly to AuthForm', () => {
    renderAuthForm({ onSubmit, mocks: [] });

    expect(AuthForm).toHaveBeenCalledWith(
      expect.objectContaining({
        onSubmit,
        handleSubmit: expect.any(Function),
        control: expect.any(Object),
        formValidationErrors: expect.any(Object),
      }),
      {}
    );
  });
});
