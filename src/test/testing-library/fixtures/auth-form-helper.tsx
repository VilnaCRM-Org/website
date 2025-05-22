import { RenderResult } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { RegisterItem } from '../../../features/landing/types/authentication/form';
import { renderWithProviders } from '../utils';

import {
  AuthFormWrapperProps,
  ExtendedMockedResponse,
  fulfilledMockResponse,
  OnSubmitType,
} from './auth-test-helpers';

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
