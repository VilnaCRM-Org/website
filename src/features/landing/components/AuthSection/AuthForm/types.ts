import { MutationFunction } from '@apollo/client';

import { SignupMutationVariables } from '../../../api/service/types';
// import { NotificationType } from '../../Notification/types';
// import { RegisterItem } from '@/features/landing/types/authentication/form';

export interface AuthenticationProps {
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  isAuthenticated: boolean;
}

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

export type AuthFormProps = Omit<AuthenticationProps, 'isAuthenticated'> & {
  signupMutation: MutationFunction<CreateUserPayload, SignUpVariables>;
  // setNotificationType: (type: NotificationType) => void;
  // notificationType: NotificationType | null;
  // onSubmit: (data: RegisterItem) => Promise<void>;

  // setServerError:(error: string) => void;
  // serverError:string;
};
