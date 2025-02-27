import { MockedProvider } from '@apollo/client/testing';
import { render, RenderResult } from '@testing-library/react';
import React, { RefObject, useRef } from 'react';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import { CallableRef } from '../../features/landing/components/AuthSection/AuthForm/types';
import { NotificationType } from '../../features/landing/components/Notification/types';

interface AuthPropsForMock {
  errorDetails: string | undefined;
  notificationType: NotificationType | undefined;
  mockOnSubmit: jest.Mock;
}

export function AuthFormWithRef({
  errorDetails,
  notificationType,
  mockOnSubmit,
}: AuthPropsForMock): React.ReactElement {
  const formRef: RefObject<CallableRef> = useRef(null);
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
export function renderAuthForm({
  errorDetails,
  notificationType,
  mockOnSubmit,
}: AuthPropsForMock): RenderResult {
  return render(
    <AuthFormWithRef
      errorDetails={errorDetails}
      notificationType={notificationType}
      mockOnSubmit={mockOnSubmit}
    />
  );
}
