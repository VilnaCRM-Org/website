import { TypedDocumentNode, gql } from '@apollo/client';

import { SignUpInput } from './types';

const SIGNUP_MUTATION: TypedDocumentNode<SignUpInput> = gql`
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
