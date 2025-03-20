import { ApolloError } from '@apollo/client';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import React from 'react';

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

  test('should handle network error correctly', async () => {
    const networkErrorMock: MockedResponse[] = [
      {
        request: {
          query: SIGNUP_MUTATION,
          variables: {
            input: {
              email: testEmail,
              initials: testInitials,
              password: testPassword,
              clientMutationId: expect.any(String),
            },
          },
        },
        error: new Error('Network error occurred'),
      },
    ];
    render(
      <MockedProvider mocks={networkErrorMock} addTypename={false}>
        <AuthLayout />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(handleApolloError).toHaveBeenCalledTimes(1);
      expect(handleApolloError).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          setErrorDetails: expect.any(Function),
          setNotificationType: expect.any(Function),
          setIsNotificationOpen: expect.any(Function),
        })
      );
    });
  });

  test('should handle GraphQL error correctly', async () => {
    const graphqlErrorMock: MockedResponse[] = [
      {
        request: {
          query: SIGNUP_MUTATION,
          variables: {
            input: {
              email: 'test@example.com',
              initials: 'Test User',
              password: 'Password123!',
              clientMutationId: '132',
            },
          },
        },
        result: {
          errors: [new GraphQLError('Email already exists')],
        },
      },
    ];

    render(
      <MockedProvider mocks={graphqlErrorMock} addTypename={false}>
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
    });
  });
});
