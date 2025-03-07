import { useImperativeHandle, ForwardedRef } from 'react';
import { UseFormHandleSubmit } from 'react-hook-form';

import { RegisterItem } from '../types/authentication/form';

interface ImperativeSubmitHandle {
  submit: () => void;
}
interface UseImperativeSubmitProps {
  ref: ForwardedRef<ImperativeSubmitHandle>;
  handleSubmit: UseFormHandleSubmit<RegisterItem>;
  onSubmit: (data: RegisterItem) => void;
}

type UseImperativeSubmitHook = (props: UseImperativeSubmitProps) => void;

const useImperativeSubmit: UseImperativeSubmitHook = ({
  ref,
  handleSubmit,
  onSubmit,
}: UseImperativeSubmitProps): void => {
  useImperativeHandle(
    ref,
    () => ({
      submit: (): void => {
        handleSubmit(onSubmit)();
      },
    }),
    [onSubmit]
  );
};

export default useImperativeSubmit;
