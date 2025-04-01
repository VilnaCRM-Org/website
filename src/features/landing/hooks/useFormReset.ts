import { useEffect } from 'react';

import { RegisterItem } from '../types/authentication/form';

interface FormState {
  isSubmitSuccessful: boolean;
}

interface UseFormResetProps {
  formState: FormState;
  reset: (values: RegisterItem) => void;
  apiErrorDetails: string;
  notificationType?: string;
}
type UseFormResetHook = ({
  formState,
  reset,
  apiErrorDetails,
  notificationType,
}: UseFormResetProps) => void;

const useFormReset: UseFormResetHook = ({
  formState,
  reset,
  apiErrorDetails,
  notificationType,
}: UseFormResetProps): void => {
  useEffect(() => {
    if (formState.isSubmitSuccessful && !apiErrorDetails.length && notificationType !== 'error') {
      reset({ Email: '', FullName: '', Password: '', Privacy: false });
    }
  }, [formState, reset, apiErrorDetails, notificationType]);
};

export default useFormReset;
