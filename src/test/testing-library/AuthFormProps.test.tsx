import { MockedProvider } from '@apollo/client/testing';
import { render } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { AuthFormWrapperProps, OnSubmitType } from './utils';

function AuthFormWrapper({
  serverErrorMessage,
  onSubmit,
}: AuthFormWrapperProps): React.ReactElement {
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
      serverErrorMessage={serverErrorMessage}
      onSubmit={onSubmit}
      handleSubmit={handleSubmit}
      formValidationErrors={errors}
      control={control}
      loading={false}
    />
  );
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
    const serverErrorMessage: string = 'Invalid credentials';

    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthFormWrapper serverErrorMessage={serverErrorMessage} onSubmit={onSubmit} />
      </MockedProvider>
    );

    expect(AuthForm).toHaveBeenCalledWith(
      expect.objectContaining({
        serverErrorMessage,
        onSubmit,
        handleSubmit: expect.any(Function),
        control: expect.any(Object),
        formValidationErrors: expect.any(Object),
      }),
      {}
    );
  });
});
