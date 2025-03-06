import { useEffect } from 'react';

import {RegisterItem} from '../types/authentication/form';


interface FormState {
  isSubmitSuccessful: boolean;
}


interface UseFormResetProps {
  formState: FormState;
  reset: (values: RegisterItem) => void;
  errorDetails:string;
  notificationType?: string;
}
type UseFormResetHook = ({formState, reset, errorDetails, notificationType}: UseFormResetProps)=>void;

const useFormReset: UseFormResetHook = ({ formState, reset, errorDetails, notificationType }: UseFormResetProps):void => {
  useEffect(() => {
    if (formState.isSubmitSuccessful && !errorDetails.length && notificationType !== 'error') {
      reset({ Email: '', FullName: '', Password: '', Privacy: false });
    }
  }, [formState, reset, errorDetails, notificationType]);
};

export default useFormReset;
