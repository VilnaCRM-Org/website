import { MockedProvider } from '@apollo/client/testing';
import { render, RenderResult } from '@testing-library/react';
import React, { RefObject, useRef } from 'react';
import {Controller, useForm} from 'react-hook-form';
import {Trans} from 'react-i18next';

import {UiCheckbox, UiLink, UiTypography} from '@/components';

import AuthForm from '../../../features/landing/components/AuthSection/AuthForm/AuthForm';
import styles from '../../../features/landing/components/AuthSection/AuthForm/styles';
import { CallableRef } from '../../../features/landing/components/AuthSection/AuthForm/types';
import { NotificationType } from '../../../features/landing/components/Notification/types';
import {RegisterItem} from '../../../features/landing/types/authentication/form';


export interface AuthPropsForMock {
  errorDetails: string | undefined;
  notificationType: NotificationType | undefined;
  mockOnSubmit: (data: RegisterItem) => Promise<void>;
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
export function mockRenderAuthForm({
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


export function AuthLinksMock({ url }:{url:string }):React.ReactElement {
  const {  control } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });
  const PRIVACY_LINK: string = url && typeof url === 'string' && url.trim()
    ? url
    : 'https://github.com/VilnaCRM-Org';
  return (
    <form>
      <Controller
        control={control}
        name="Privacy"
        rules={{ required: true }}
        render={({ field: { value, onChange } }) => (
          <UiCheckbox
            onChange={onChange}
            checked={value}
            sx={styles.labelText as React.CSSProperties}
            label={
              <UiTypography variant="medium14" sx={styles.privacyText}>
                <Trans i18nKey="sign_up.form.confidential_text.fullText">
                  I have read and accept the
                  <UiLink href={PRIVACY_LINK} target="_blank">
                    Privacy Policy
                  </UiLink>
                  and the
                  <UiLink href={PRIVACY_LINK} target="_blank">
                    Use Policy
                  </UiLink>
                  VilnaCRM Service
                </Trans>
              </UiTypography>
            }
          />
        )}
      />

    </form>
  );
};
