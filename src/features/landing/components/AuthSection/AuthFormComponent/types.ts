import { MutationFunction } from '@apollo/client';

import { SignupMutationVariables } from '../../../api/service/types';

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
};
