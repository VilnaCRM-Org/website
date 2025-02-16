import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { render, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { testEmail, testInitials, testPassword } from '@/test/testing-library/constants';
import { fillForm } from '@/test/testing-library/utils';

import { SIGNUP_MUTATION } from '../../features/landing/api/service/userService';
import AuthFormComponent from '../../features/landing/components/AuthSection/AuthFormComponent/AuthFormComponent';

const statusRole: string = 'status';
const alertRole: string = 'alert';

const notificationId: string = 'notification';
const formTitleText: string = t('sign_up.form.heading_main');

const fulfilledMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
  },
  variableMatcher: () => true,
  result: variables => {
    const { input } = variables;
    const { initials, email, password, clientMutationId } = input;

    expect(input).not.toBeUndefined();
    expect(initials).toBe(testInitials);
    expect(email).toBe(testEmail);
    expect(password).toBe(testPassword);
    expect(clientMutationId).toBe('132');

    return {
      data: {
        createUser: {
          user: {
            email,
            initials,
            id: 0,
            confirmed: true,
          },
          clientMutationId: '132',
        },
      },
    };
  },
};

const rejectedMockResponse: MockedResponse = {
  request: {
    query: SIGNUP_MUTATION,
    variables: {
      input: {},
    },
  },
  error: { name: 'MockError', message: 'Server Error' },
};

describe('AuthFormComponent', () => {
  it('renders the component correctly', () => {
    const { getByText } = render(
      <MockedProvider mocks={[]} addTypename={false}>
        <AuthFormComponent />
      </MockedProvider>
    );
    const formTitle: HTMLElement = getByText(formTitleText);
    expect(formTitle).toBeInTheDocument();
  });

  it('successful registration', async () => {
    const { getByRole, queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormComponent />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      const loader: HTMLElement = getByRole(statusRole);
      expect(loader).toBeInTheDocument();
    });

    const serverErrorMessage: HTMLElement | null = queryByRole(alertRole);
    expect(serverErrorMessage).not.toBeInTheDocument();
  });
  test('shows loading spinner when loading is true', async () => {
    const { queryByRole } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormComponent />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(queryByRole('status')).not.toBeInTheDocument();
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(queryByRole('status')).toBeInTheDocument();
    });
  });

  it('registration with server error', async () => {
    const { findByRole } = render(
      <MockedProvider mocks={[rejectedMockResponse]} addTypename={false}>
        <AuthFormComponent />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    const serverErrorMessage: HTMLElement = await findByRole(alertRole);
    expect(serverErrorMessage).toBeInTheDocument();
  });
  it('shows success notification after successful authentication', async () => {
    const { getByTestId } = render(
      <MockedProvider mocks={[fulfilledMockResponse]} addTypename={false}>
        <AuthFormComponent />
      </MockedProvider>
    );

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(getByTestId(notificationId)).toBeInTheDocument();
    });
  });
});
