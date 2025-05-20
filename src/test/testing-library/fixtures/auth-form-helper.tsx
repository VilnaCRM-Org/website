import { MockedResponse } from '@apollo/client/testing';
import { RenderResult } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../features/landing/api/service/userService';
import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../../features/landing/types/authentication/form';
import { testEmail, testInitials, testPassword } from '../constants';
import { renderWithProviders } from '../utils';

import { AuthFormWrapperProps, OnSubmitType } from './auth-test-helpers';

const fulfilledMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: () => true,
  newData: variables => {
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

function AuthFormWrapper({ onSubmit, loading = false }: AuthFormWrapperProps): React.ReactElement {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({ mode: 'onTouched' });

  return (
    <AuthForm
      onSubmit={onSubmit}
      handleSubmit={handleSubmit}
      formValidationErrors={errors}
      control={control}
      loading={loading}
    />
  );
}
interface RenderAuthFormOptions extends Partial<AuthFormWrapperProps> {
  mocks?: MockedResponse[];
}
const mockSubmitSuccess: () => OnSubmitType = (): OnSubmitType =>
  jest.fn().mockResolvedValueOnce(undefined);

export function renderAuthForm({
  onSubmit = mockSubmitSuccess(),
  mocks = [fulfilledMockResponse],
  loading = false,
}: RenderAuthFormOptions = {}): RenderResult {
  return renderWithProviders(<AuthFormWrapper onSubmit={onSubmit} loading={loading} />, {
    apolloMocks: mocks,
  });
}
