import { TypedDocumentNode } from '@apollo/client';
import { MockedResponse } from '@apollo/client/testing';
import { RenderResult } from '@testing-library/react';

import { CreateUserInput } from '@/test/apollo-server/types';
import { testEmail, testInitials, testPassword } from '@/test/testing-library/constants';
import { ServerError } from '@/test/testing-library/fixtures/errors';
import { renderWithProviders } from '@/test/testing-library/utils';

import { SignUpInput } from '../../../features/landing/api/service/types';
import SIGNUP_MUTATION from '../../../features/landing/api/service/userService';
import AuthLayout from '../../../features/landing/components/AuthSection/AuthForm/AuthLayout';
import { RegisterItem } from '../../../features/landing/types/authentication/form';

export function renderAuthLayout(mocks: MockedResponse[] = []): RenderResult {
  return renderWithProviders(<AuthLayout />, { apolloMocks: mocks });
}

const validateCreateUserInput: (variables: { input: CreateUserInput }) => boolean = (variables: {
  input: CreateUserInput;
}) => {
  const { input } = variables;
  return !!input.email && !!input.initials && !!input.password && !!input.clientMutationId;
};
export interface ExtendedMockedResponse extends MockedResponse {
  variableMatcher: (variables: { input: CreateUserInput }) => boolean;
}
export const fulfilledMockResponse: ExtendedMockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: validateCreateUserInput,

  newData: variables => {
    const { input } = variables;
    const { initials, email, clientMutationId } = input;

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId,
        },
      },
    };
  },
};

type CreateTestInputFn = (overrides?: Partial<CreateUserInput>) => CreateUserInput;

const createTestInput: CreateTestInputFn = (overrides = {}) => ({
  email: testEmail.toLowerCase(),
  initials: testInitials,
  password: testPassword,
  clientMutationId: '132',
  ...overrides,
});

const input: CreateUserInput = createTestInput();

const networkError: Error = new ServerError();
export const mockNetworkErrorAndSuccessResponses: MockedResponse[] = [
  {
    request: {
      query: SIGNUP_MUTATION,
      variables: { input },
    },
    error: networkError,
  },
  fulfilledMockResponse,
];

type RequestType = { query: TypedDocumentNode<SignUpInput>; variables: { input: CreateUserInput } };
const request: RequestType = {
  query: SIGNUP_MUTATION,
  variables: { input },
};

export const mockUserExistsErrorResponse: MockedResponse = {
  request,
  result: {
    errors: [
      {
        message: 'A user with this email already exists.',
        locations: [{ line: 1, column: 1 }],
        path: ['createUser'],
        extensions: {
          code: 'BAD_USER_INPUT',
        },
      },
    ],
  },
};

export const mockInternalServerErrorResponse: MockedResponse = {
  request,
  result: {
    errors: [
      {
        message: 'Internal Server Error.',
        locations: [{ line: 1, column: 1 }],
        path: ['createUser'],
        extensions: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      },
    ],
  },
};

export type SetIsOpenType = jest.Mock<void, [boolean]>;
export type OnSubmitType = jest.Mock<Promise<void>, [RegisterItem]>;

export interface AuthFormWrapperProps {
  onSubmit: OnSubmitType;
  loading?: boolean;
}
