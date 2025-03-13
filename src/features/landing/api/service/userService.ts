import { TypedDocumentNode, gql } from '@apollo/client';

import { SignupMutationVariables } from './types';

const SIGNUP_MUTATION: TypedDocumentNode<SignupMutationVariables> = gql`
  mutation AddUser($input: createUserInput!) {
    createUser(input: $input) {
      user {
        email
        initials
        id
        confirmed
      }
      clientMutationId
    }
  }
`;
export default SIGNUP_MUTATION;
