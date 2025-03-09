import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, RenderResult } from '@testing-library/react';
import React from 'react';
import {  FieldErrors, useForm } from 'react-hook-form';

import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { AuthFormProps } from '../../../features/landing/components/AuthSection/AuthForm/types';
import { RegisterItem } from '../../../features/landing/types/authentication/form';


export const mockErrors: FieldErrors<RegisterItem> = {
  Email: { type: 'required', message: 'Email is required' },
  Password: { type: 'minLength', message: 'Password must be at least 6 characters' },
  Privacy: { type: 'required', message: 'You must accept the privacy policy' },
};

type MockFormWrapperProps = Omit<AuthFormProps, 'control'> & {
  children: (args: AuthFormProps) => React.ReactElement;
  mocks: MockedResponse[];
};
export function MockFormWrapper({
  children,
  errorDetails,
  onSubmit,
  handleSubmit,
  mocks,
  errors,
}: MockFormWrapperProps): React.ReactElement {
  const { control } = useForm<RegisterItem>({
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });

  return (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children({ control, errorDetails, onSubmit, handleSubmit, errors })}
    </MockedProvider>
  );
}

type RenderAuthFormProps = Omit<AuthFormProps, 'control'> & { mocks: MockedResponse[] };
export function mockRenderAuthForm(props: RenderAuthFormProps): RenderResult {
  return render(
    <MockFormWrapper {...props}>
      {({ control, errorDetails, onSubmit, handleSubmit, errors }) => (
        <AuthForm
          errorDetails={errorDetails}
          onSubmit={onSubmit}
          handleSubmit={handleSubmit}
          errors={errors}
          control={control}
        />
      )}
    </MockFormWrapper>
  );
}

export function AuthLinksMock({ url }: { url: string }): React.ReactElement {
  const defaultUrl: string = 'https://github.com/VilnaCRM-Org';
  const privacyPolicyUrl: string = process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL?.trim()
    ? process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL
    : defaultUrl;
  return (
    <form>
      <a href={url?.trim() || privacyPolicyUrl}>Privacy Policy</a>
      <a href={url?.trim() || privacyPolicyUrl}>Use Policy</a>
    </form>
  );
}
