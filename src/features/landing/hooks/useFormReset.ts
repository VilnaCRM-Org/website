import { useEffect } from 'react';

import { RegisterItem } from '../types/authentication/form';

interface FormState {
  isSubmitSuccessful: boolean;
}

interface UseFormResetProps {
  formState: FormState;
  reset: (values: RegisterItem) => void;
  serverErrorMessage: string;
  notificationType?: string;
}
type UseFormResetHook = ({
  formState,
  reset,
  serverErrorMessage,
  notificationType,
}: UseFormResetProps) => void;

const useFormReset: UseFormResetHook = ({
  formState,
  reset,
  serverErrorMessage,
  notificationType,
}: UseFormResetProps) => {
  useEffect(() => {
    if (
      formState.isSubmitSuccessful &&
      !serverErrorMessage.length &&
      notificationType !== 'error'
    ) {
      reset({ Email: '', FullName: '', Password: '', Privacy: false });
    }
  }, [formState, reset, serverErrorMessage, notificationType]);
};

export default useFormReset;
