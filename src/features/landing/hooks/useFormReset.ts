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

type UseFormResetHook = (props: UseFormResetProps) => void;

const initialFormValues: RegisterItem = { Email: '', FullName: '', Password: '', Privacy: false };

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
      reset(initialFormValues);
    }
  }, [formState, reset, serverErrorMessage, notificationType]);
};

export default useFormReset;
