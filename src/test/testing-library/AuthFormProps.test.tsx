import { MockedResponse } from '@apollo/client/testing';
import { RenderResult } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import AuthForm from '../../features/landing/components/AuthSection/AuthForm/AuthForm';
import Notification from '../../features/landing/components/Notification';
import {
  NotificationControlProps,
  NotificationStatus,
} from '../../features/landing/components/Notification/types';
import { RegisterItem } from '../../features/landing/types/authentication/form';

import { AuthFormWrapperProps, OnSubmitType, renderAuthLayout } from './fixtures/auth-test-helpers';
import { renderWithProviders } from './utils';

function AuthFormWrapper({ onSubmit }: AuthFormWrapperProps): React.ReactElement {
  const [notificationType] = React.useState<NotificationStatus>(NotificationStatus.SUCCESS);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState<boolean>(false);
  const [errorText] = React.useState('');
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });

  return (
    <>
      <AuthForm
        onSubmit={onSubmit}
        handleSubmit={handleSubmit}
        formValidationErrors={errors}
        control={control}
        loading={false}
      />
      <Notification
        errorText={errorText}
        type={notificationType}
        setIsOpen={setIsNotificationOpen}
        isOpen={isNotificationOpen}
        onRetry={() => {}}
        loading={false}
      />
    </>
  );
}
function renderAuthForm({
  onSubmit,
  mocks,
}: {
  mocks?: MockedResponse[];
  onSubmit?: OnSubmitType;
}): RenderResult {
  const submitHandler: OnSubmitType =
    onSubmit ?? jest.fn<Promise<void>, [RegisterItem]>().mockResolvedValue(undefined);

  return renderWithProviders(<AuthFormWrapper onSubmit={submitHandler} />, {
    apolloMocks: mocks || [],
  });
}
type DefaultValue = { FullName: ''; Password: ''; Email: ''; Privacy: false };

jest.mock('../../features/landing/components/AuthSection/AuthForm/AuthForm', () => ({
  __esModule: true,
  default: jest.fn(({ control }) => {
    const { _options } = control || {};
    const defaultValues: DefaultValue = control?.getValues
      ? control.getValues()
      : _options?.defaultValues || {};

    return <div data-testid="auth-form-mock" data-control={JSON.stringify(defaultValues)} />;
  }),
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

describe('AuthFormWrapper - Default Values', () => {
  it('passes correct default values to AuthForm control configuration', () => {
    const onSubmit: OnSubmitType = jest
      .fn<Promise<void>, [RegisterItem]>()
      .mockResolvedValueOnce(undefined);
    renderAuthForm({ onSubmit, mocks: [] });

    expect(AuthForm).toHaveBeenCalledWith(
      expect.objectContaining({
        control: expect.objectContaining({
          _options: expect.objectContaining({
            defaultValues: {
              Email: '',
              FullName: '',
              Password: '',
              Privacy: false,
            },
          }),
        }),
      }),
      {}
    );
  });
  it('renders form with initial default values in the control object', () => {
    const { getByTestId } = renderAuthLayout();

    const controlData: string | null = getByTestId('auth-form-mock').getAttribute('data-control');

    expect(JSON.parse(controlData || '')).toEqual({
      Email: '',
      FullName: '',
      Password: '',
      Privacy: false,
    });
  });
});

jest.mock('../../features/landing/components/Notification', () => ({
  __esModule: true,
  default: jest.fn(({ errorText, type, isOpen, loading }: NotificationControlProps) => (
    <div
      data-testid="notification-mock"
      data-errortext={errorText}
      data-type={type}
      data-isopen={isOpen}
      data-loading={loading}
    />
  )),
}));

describe('AuthFormWrapper - Notification props', () => {
  it('should call Notification with correct initial props', () => {
    renderAuthForm({ onSubmit: jest.fn(), mocks: [] });

    expect(Notification).toHaveBeenCalledWith(
      expect.objectContaining({
        errorText: '',
        type: NotificationStatus.SUCCESS,
        setIsOpen: expect.any(Function),
        isOpen: false,
        onRetry: expect.any(Function),
        loading: false,
      }),
      {}
    );
  });
});
