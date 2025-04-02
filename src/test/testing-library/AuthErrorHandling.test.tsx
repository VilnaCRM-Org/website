import { ApolloError } from '@apollo/client';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, waitFor, screen } from '@testing-library/react';
import React from 'react';

import { CreateUserInput } from '@/test/apollo-server/types';

import SIGNUP_MUTATION from '../../features/landing/api/service/userService';
import AuthLayout from '../../features/landing/components/AuthSection/AuthForm';
import {
  handleApolloError,
  HandleApolloErrorProps,
} from '../../features/landing/helpers/handleApolloError';

import { testEmail, testInitials, testPassword } from './constants';
import { fillForm } from './utils';

jest.mock('../../features/landing/helpers/handleApolloError', () => ({
  handleApolloError: jest.fn(),
}));

describe('AuthLayout Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const input: CreateUserInput = {
    email: testEmail,
    initials: testInitials,
    password: testPassword,
    clientMutationId: expect.any(String),
  };

  test('should handle network error correctly', async () => {
    const networkErrorMocks: MockedResponse[] = [
      {
        request: {
          query: SIGNUP_MUTATION,
          variables: { input },
        },
        error: new Error('Network error occurred'),
      },
    ];
    render(
      <MockedProvider mocks={networkErrorMocks} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );
    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(handleApolloError).toHaveBeenCalledTimes(1);
      expect(handleApolloError).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          setServerErrorMessage: expect.any(Function),
          setNotificationType: expect.any(Function),
          setIsNotificationOpen: expect.any(Function),
        })
      );
    });
  });

  test('should handle GraphQL error correctly', async () => {
    const graphqlErrorMocks: MockedResponse[] = [
      {
        request: {
          query: SIGNUP_MUTATION,
          variables: { input },
        },
        result: {
          errors: [
            {
              message: 'Email already exists',
              locations: [{ line: 1, column: 1 }],
              path: ['signup'],
              extensions: { code: 'DUPLICATE_EMAIL' },
            },
          ],
        },
      },
    ];

    render(
      <MockedProvider mocks={graphqlErrorMocks} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(handleApolloError).toHaveBeenCalledTimes(1);
      const callArg: HandleApolloErrorProps = (handleApolloError as jest.Mock).mock.calls[0][0];
      expect(callArg.err).toBeDefined();

      const error: ApolloError = callArg.err as ApolloError;
      expect(error.graphQLErrors).toBeDefined();

      callArg.setServerErrorMessage('Email already exists');
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Email already exists');
    });
  });
});
