/**
 * Integration: registration form → GraphQL flow (multi-module).
 *
 * Renders the REAL `AuthLayout` wired to the REAL Apollo Client via
 * `ApolloProvider` (NOT `MockedProvider`), with the network stubbed at the
 * `fetch` boundary. This exercises the whole vertical slice in one test:
 *
 *   form input → react-hook-form validation → AuthLayout.onSubmit
 *   → uuid client id → useMutation → real HttpLink → fetch
 *   → response parsing → handleApolloError → Notification UI
 *
 * The `testing-library` layer covers these components with the Apollo link
 * mocked; this layer additionally proves the real transport and the cross-module
 * data transform (email lower-casing, generated clientMutationId) end-to-end.
 */
import { ApolloProvider } from '@apollo/client/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';

import AuthLayout from '@landing/auth-section/auth-form/auth-layout';

import client from '../../../src/features/landing/api/graphql/apollo';
import {
  FetchMock,
  graphqlData,
  graphqlErrors,
  installFetchMock,
  readGraphQLRequest,
  restoreFetch,
} from '../utils/graphql-network';

const credentials = {
  fullName: 'Integration Tester',
  email: 'New.User@Example.com',
  password: 'Integration123',
};

function successPayload(email: string, initials: string): unknown {
  return {
    createUser: {
      user: { id: 'user-1', email, initials, confirmed: true, __typename: 'User' },
      clientMutationId: 'server-echoed-id',
      __typename: 'createUserPayload',
    },
  };
}

function renderRegistration(): void {
  render(
    <ApolloProvider client={client}>
      <AuthLayout />
    </ApolloProvider>
  );
}

// Inputs are located by placeholder: the production inputs do not yet expose a
// programmatic label association (tracked separately), so placeholder is the
// only working accessible query for the text fields. The checkbox and submit
// button are queried by role + accessible name.
function fillAndSubmitRegistrationForm(): void {
  fireEvent.change(screen.getByPlaceholderText(t('sign_up.form.name_input.placeholder')), {
    target: { value: credentials.fullName },
  });
  fireEvent.change(screen.getByPlaceholderText(t('sign_up.form.email_input.placeholder')), {
    target: { value: credentials.email },
  });
  fireEvent.change(screen.getByPlaceholderText(t('sign_up.form.password_input.placeholder')), {
    target: { value: credentials.password },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: t('sign_up.form.button_text') }));
}

describe('integration: registration form submission flow', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(async () => {
    restoreFetch();
    // The Apollo client is a module singleton shared across tests; clear its
    // cache so a mutation result cannot leak into a later test.
    await client.clearStore();
  });

  it('submits through the real client and shows the success notification', async () => {
    const expectedEmail = credentials.email.toLowerCase();
    fetchMock.mockResolvedValue(graphqlData(successPayload(expectedEmail, credentials.fullName)));

    renderRegistration();

    // The privacy checkbox must keep a programmatic accessible name.
    expect(screen.getByRole('checkbox')).toHaveAccessibleName();

    fillAndSubmitRegistrationForm();

    // The success notification is mounted-but-hidden by default (MUI Fade keeps
    // it in the DOM), so assert visibility — and that the error notification is
    // absent — only after the network round-trip has actually fired.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByText(t('notifications.success.title'))).toBeVisible();
      expect(screen.queryByText(t('notifications.error.title'))).not.toBeInTheDocument();
    });

    const request = readGraphQLRequest(fetchMock);
    const input = request.body.variables.input as {
      email: string;
      initials: string;
      password: string;
      clientMutationId: string;
    };
    expect(input.email).toBe(expectedEmail);
    expect(input.initials).toBe(credentials.fullName);
    expect(input.password).toBe(credentials.password);
    expect(typeof input.clientMutationId).toBe('string');
    expect(input.clientMutationId.length).toBeGreaterThan(0);
  });

  it('shows the error notification when the API rejects the registration', async () => {
    fetchMock.mockResolvedValue(
      graphqlErrors([
        {
          message: 'A user with this email already exists.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ])
    );

    renderRegistration();
    fillAndSubmitRegistrationForm();

    await waitFor(() => {
      expect(screen.getByText(t('notifications.error.title'))).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
