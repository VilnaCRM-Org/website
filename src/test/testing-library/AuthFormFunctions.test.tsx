import {fireEvent, render, waitFor} from '@testing-library/react';
import {t} from 'i18next';
import {act} from 'react';

import { CallableRef} from '../../features/landing/components/AuthSection/AuthForm/types';
import NotificationError from '../../features/landing/components/Notification/NotificationError';
import isHttpError from '../../features/landing/helpers/isHttpError';
import {RegisterItem} from '../../features/landing/types/authentication/form';

import '@testing-library/jest-dom';
import {testEmail, testInitials, testPassword} from './constants';
import {AuthPropsForMock, mockRenderAuthForm} from './mock-render/MockRenderAuthForm';
import {fillForm} from './utils';


const retryButtonText:string =t('notifications.error.retry_button');

type CreateUserPayload ={
  data: {
    success: boolean;
  };
};

type SignupMutationVariables = {
 variables:{
  input: {
    email: string;
    initials: string;
    password: string;
    clientMutationId: string;
  };
 };
};

const signupMutation: jest.MockedFunction<(variables: SignupMutationVariables) =>
  Promise<CreateUserPayload>> = jest.fn();


type AuthFormTestHelpers = {
  setNotificationType: jest.Mock;
  setErrorDetails: jest.Mock;
  setIsNotificationOpen: jest.Mock;
  mockOnSubmit: (data: RegisterItem) => Promise<void>;
};
type SetupAuthFormTestType = (signupMutationMock: jest.MockedFunction<
  (variables: SignupMutationVariables) => Promise<CreateUserPayload>
>) => AuthFormTestHelpers;

export const setupAuthFormTest: SetupAuthFormTestType = (signupMutationMock)  => {
  const setNotificationType: jest.Mock = jest.fn();
  const setErrorDetails: jest.Mock = jest.fn();
  const setIsNotificationOpen: jest.Mock = jest.fn();

  const mockOnSubmit: (data: RegisterItem) => Promise<void> = async (data: RegisterItem) =>  {
    try {
     await signupMutationMock({
        variables: {
          input: {
            email: data.Email,
            initials: data.FullName,
            password: data.Password,
            clientMutationId: '132',
          },
        },
      });
      setErrorDetails('');
      setIsNotificationOpen(true);
      setNotificationType('success');
    } catch (error) {
      if (isHttpError(error)) {
        if (error.statusCode === 500) {
          setNotificationType('error');
          setIsNotificationOpen(true);
          setErrorDetails('');
        } else {
          setErrorDetails(error.message);
        }
      } else if (error instanceof Error) {
        setErrorDetails(error.message);
      } else {
        setErrorDetails('An unexpected error occurred');
      }
    }
  };

  return { setNotificationType, setErrorDetails, setIsNotificationOpen, mockOnSubmit };
};
export type AuthPropsWithFormRef = AuthPropsForMock & {
  formRef?: React.RefObject<CallableRef>;
  mockOnSubmit: (data: RegisterItem) => Promise<void>;
};
describe('mockOnSubmit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  it('should handle successful form submission', async () => {
    signupMutation.mockResolvedValueOnce({ data: { success: true } });
    const { setNotificationType, setErrorDetails, setIsNotificationOpen, mockOnSubmit } =
      setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setErrorDetails).toHaveBeenCalledWith('');
      expect(setIsNotificationOpen).toHaveBeenCalledWith(true);
      expect(setNotificationType).toHaveBeenCalledWith('success');
    });
  });

  it('displays error message when signup mutation fails', async () => {
    signupMutation.mockRejectedValueOnce({ data: {  success: false }});
    const {  setErrorDetails,  mockOnSubmit } = setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: 'Something went wrong',
      notificationType: 'error',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setErrorDetails).toHaveBeenCalledWith('An unexpected error occurred');

    });
  });
  it('should handle unexpected errors correctly', async () => {
    signupMutation.mockRejectedValueOnce(42);
    const { setIsNotificationOpen, setNotificationType, setErrorDetails,  mockOnSubmit } = setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: 'An unexpected error occurred',
      notificationType: 'error',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setErrorDetails).toHaveBeenCalled();
      expect(setErrorDetails).toHaveBeenCalledWith('An unexpected error occurred');
      expect(setIsNotificationOpen).not.toHaveBeenCalled();
      expect(setNotificationType).not.toHaveBeenCalled();
    });
  });
  it('should handle server error (500) correctly', async () => {
    signupMutation.mockRejectedValueOnce({
      statusCode: 500,
      message: 'Internal Server Error',
    });

    const {setIsNotificationOpen,setNotificationType, setErrorDetails, mockOnSubmit } = setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'error',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setIsNotificationOpen).toHaveBeenCalledWith(true);
      expect(setNotificationType).toHaveBeenCalledWith('error');
      expect(setErrorDetails).toHaveBeenCalledWith('');
    });
  });

  it('should handle formRef.current?.submit is not defined', async () => {
    signupMutation.mockResolvedValueOnce({ data: { success: true } });
    const { setNotificationType, setErrorDetails, setIsNotificationOpen, mockOnSubmit } =
      setupAuthFormTest(signupMutation);

    const mockRenderAuthFormWithouthFormRef:(props: AuthPropsWithFormRef) => void = (props) => {
      mockRenderAuthForm({
        ...props,
      });
    };
    mockRenderAuthFormWithouthFormRef({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit,
      formRef: undefined,
    });
    await waitFor(async () => {
      await fillForm(testInitials, testEmail, testPassword, true);
      expect(setErrorDetails).not.toHaveBeenCalled();
      expect(setIsNotificationOpen).not.toHaveBeenCalled();
      expect(setNotificationType).not.toHaveBeenCalled();

    });
  });
  it('should handle notificationType set to empty string initially', async () => {
    signupMutation.mockRejectedValueOnce(new Error('Test error'));

    const { setNotificationType, setIsNotificationOpen, mockOnSubmit } =
      setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: undefined,
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setNotificationType).not.toHaveBeenCalledWith('success');
      expect(setIsNotificationOpen).not.toHaveBeenCalledWith(true);
    });
  });
  it('should handle when isHttpError always true', async () => {
    signupMutation.mockRejectedValueOnce({ statusCode: 404, message: 'Not Found' });

    const { setNotificationType, setErrorDetails,setIsNotificationOpen, mockOnSubmit } =
      setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: undefined,
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setErrorDetails).toHaveBeenCalledWith('Not Found');
      expect(setNotificationType).not.toHaveBeenCalledWith('success');
      expect(setIsNotificationOpen).not.toHaveBeenCalledWith(true);
    });
  });
  it('should handle when error instanceof Error is always true', async () => {
    signupMutation.mockRejectedValueOnce(new Error('Test error'));

    const { setNotificationType, setErrorDetails, setIsNotificationOpen, mockOnSubmit } =
      setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: undefined,
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setErrorDetails).toHaveBeenCalledWith('Test error');
      expect(setNotificationType).not.toHaveBeenCalled();
      expect(setIsNotificationOpen).not.toHaveBeenCalled();
    });
  });

  it('should handle non-HTTP errors', async () => {
    const error:Error = new Error('Network Error');
    signupMutation.mockRejectedValueOnce(error);

    const {setNotificationType, setIsNotificationOpen, setErrorDetails,  mockOnSubmit } = setupAuthFormTest(signupMutation);

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'error',
      mockOnSubmit,
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(setIsNotificationOpen).not.toHaveBeenCalled();
      expect(setNotificationType).not.toHaveBeenCalledWith('error');
      expect(setErrorDetails).toHaveBeenCalled();
    });
  });
});


describe('Across Form components', () => {

  it('calls submit() via imperative handle', async () => {
    signupMutation.mockRejectedValueOnce({
      statusCode: 500,
      message: 'Internal Server Error',
    });
    const mockRef: React.RefObject<CallableRef> = {
      current: { submit: jest.fn() },
    };
    const onSubmit: (data: RegisterItem) => Promise<void> = jest.fn() ;

    mockRenderAuthForm({
      errorDetails: 'Internal error',
      notificationType: 'error',
      mockOnSubmit:onSubmit,
    });
    fillForm(testInitials, testEmail, testPassword, true);

     const mockTriggerFormSubmit: () => void = () => {
      if (mockRef.current?.submit) {
        mockRef.current.submit();
      }
    };
    const mockSetIsOpen:jest.Mock = jest.fn();
    const {getByText}= render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );
    const retryButton:HTMLElement = getByText(retryButtonText);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });
});

//  Error Handling
type fullError = {
  statusCode: number;
  message: string;
};

describe('Error Handling', () => {
  test('handles HTTP 500 error', () => {
    const error :fullError= { statusCode: 500, message: 'Internal Server Error' };
    let errorDetails:string = '';
    let notificationOpen:boolean = false;
    let notificationType:string = '';

    act(() => {
      if (isHttpError(error)) {
        notificationOpen = true;
        notificationType = 'error';
        errorDetails = 'Internal server error, please try again later.';
      }
    });

    expect(notificationOpen).toBe(true);
    expect(notificationType).toBe('error');
    expect(errorDetails).toBe('Internal server error, please try again later.');
  });

  test('handles generic Error instance', () => {
    const error:Error = new Error('Something went wrong');
    let errorDetails:string = '';

    act(() => {
      if (error instanceof Error) {
        errorDetails = error.message;
      }
    });

    expect(errorDetails).toBe('Something went wrong');
  });

  test('handles unknown error', () => {
    const error:unknown= 42;
    let errorDetails:string = '';

    act(() => {
      if (!isHttpError(error) && !(error instanceof Error)) {
        errorDetails = 'An unexpected error occurred.';
      }
    });

    expect(errorDetails).toBe('An unexpected error occurred.');
  });
});
