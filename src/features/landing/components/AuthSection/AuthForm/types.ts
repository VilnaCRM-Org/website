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

export type AuthFormProps = {
  handleSubmit: UseFormHandleSubmit<RegisterItem, undefined>;
  control: Control<RegisterItem>;
  errors: FieldErrors<RegisterItem>;
  errorDetails: string;
  onSubmit: (data: RegisterItem) => Promise<void>;
};
