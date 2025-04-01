import { Control, FieldErrors, UseFormHandleSubmit } from 'react-hook-form';

import { SignupMutationVariables } from '../../../api/service/types';
import { RegisterItem } from '../../../types/authentication/form';

export interface SignUpVariables {
  input: SignupMutationVariables;
}

interface User {
  id: string;
  email: string;
  initials: string;
  confirmed: boolean;
  __typename: 'User';
}

export interface CreateUserPayload {
  createUser: {
    clientMutationId: string;
    user: User;
    __typename: 'createUserPayload';
  };
}
export type UseFormControl = Control<RegisterItem>;

export interface AuthFormProps {
  handleSubmit: UseFormHandleSubmit<RegisterItem, RegisterItem>;
  control: UseFormControl;
  errors: FieldErrors<RegisterItem>;
  errorDetails: string;
  onSubmit: (data: RegisterItem) => Promise<void>;
}

export enum NotificationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}
