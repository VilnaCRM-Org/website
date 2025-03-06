import { MockedProvider } from '@apollo/client/testing';
import { render, RenderResult } from '@testing-library/react';
import React, { RefObject } from 'react';

import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { CallableRef } from '../../../features/landing/components/AuthSection/AuthForm/types';
import { NotificationType } from '../../../features/landing/components/Notification/types';
import { RegisterItem } from '../../../features/landing/types/authentication/form';

export interface AuthPropsForMock {
  errorDetails: string | undefined;
  notificationType: NotificationType | undefined;
  mockOnSubmit: (data: RegisterItem) => Promise<void>;
  formRef?: RefObject<CallableRef> | null;
}

export function AuthFormWithRef({
  errorDetails,
  notificationType,
  mockOnSubmit,
  formRef = null,
}: AuthPropsForMock): React.ReactElement {
  // const formRef: RefObject<CallableRef> = useRef(null);
  return (
    <MockedProvider>
      <AuthForm
        onSubmit={mockOnSubmit}
        errorDetails={errorDetails || ''}
        notificationType={notificationType || 'success'}
        ref={formRef}
      />
    </MockedProvider>
  );
}
AuthFormWithRef.defaultProps = {
  formRef: null,
};
export function mockRenderAuthForm({
  errorDetails,
  notificationType,
  formRef,
  mockOnSubmit,
}: AuthPropsForMock): RenderResult {
  return render(
    <AuthFormWithRef
      errorDetails={errorDetails}
      notificationType={notificationType}
      mockOnSubmit={mockOnSubmit}
      formRef={formRef}
    />
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
