import { useEffect } from 'react';

import { RegisterItem } from '../types/authentication/form';

interface FormState {
  isSubmitSuccessful: boolean;
}

interface UseFormResetProps {
  formState: FormState;
  reset: (values: RegisterItem) => void;
  notificationType?: string;
}

type UseFormResetHook = (props: UseFormResetProps) => void;

const initialFormValues: RegisterItem = { Email: '', FullName: '', Password: '', Privacy: false };

const useFormReset: UseFormResetHook = ({
  formState,
  reset,
  notificationType,
}: UseFormResetProps) => {
  useEffect(() => {
    if (formState.isSubmitSuccessful && notificationType !== 'error') {
      reset(initialFormValues);
    }
  }, [formState.isSubmitSuccessful, notificationType, reset]);
};

export default useFormReset;
