import { MockedResponse } from '@apollo/client/testing';
import { RenderResult } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../features/landing/api/service/userService';
import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../../features/landing/types/authentication/form';
import { CreateUserInput } from '../../apollo-server/types';
import { testEmail, testInitials, testPassword } from '../constants';
import { renderWithProviders } from '../utils';

import { AuthFormWrapperProps, OnSubmitType } from './auth-test-helpers';

interface ExtendedMockedResponse extends MockedResponse {
  variableMatcher: (variables: { input: CreateUserInput }) => boolean;
}

const fulfilledMockResponse: ExtendedMockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: variables => {
    const { input } = variables;
    return (
      input &&
      input.initials === testInitials &&
      input.email === testEmail &&
      input.password === testPassword
    );
  },
  newData: variables => {
    const { input } = variables;
    const { initials, email, clientMutationId } = input;

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId,
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
  mocks?: ExtendedMockedResponse[];
}
const mockSubmitSuccess: () => OnSubmitType = (): OnSubmitType =>
  jest.fn().mockResolvedValueOnce(undefined);

export default function renderAuthForm({
  onSubmit = mockSubmitSuccess(),
  mocks = [fulfilledMockResponse],
  loading = false,
}: RenderAuthFormOptions = {}): RenderResult {
  return renderWithProviders(<AuthFormWrapper onSubmit={onSubmit} loading={loading} />, {
    apolloMocks: mocks,
  });
}
