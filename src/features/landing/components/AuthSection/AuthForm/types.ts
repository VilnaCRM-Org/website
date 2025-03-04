import { SignupMutationVariables } from '../../../api/service/types';
import { RegisterItem } from '../../../types/authentication/form';
import { NotificationType } from '../../Notification/types';

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
  notificationType: NotificationType;
  errorDetails: string;
  onSubmit: (data: RegisterItem) => Promise<void>;
};

export type CallableRef = {
  submit: () => void;
} | null;
