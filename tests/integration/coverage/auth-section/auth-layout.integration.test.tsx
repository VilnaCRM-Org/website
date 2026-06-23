/**
 * Integration coverage: `AuthLayout` and `AuthSection` end-to-end.
 *
 * Renders the REAL `AuthLayout`/`AuthSection` wired to the REAL Apollo Client
 * via `ApolloProvider`, stubbing only the `fetch` boundary. This drives the full
 * vertical slice: form input → react-hook-form validation → onSubmit → uuid
 * client id → useMutation → HttpLink → fetch → response parsing →
 * handleApolloError → Notification + useFormReset.
 *
 * Branches covered:
 *  - success: handleSuccess(), loader appears then disappears, form is reset,
 *    success notification shown, email lower-cased before submit.
 *  - error: catch path sets error text + ERROR notification, form NOT reset.
 *  - retry: clicking retry re-fires the mutation.
 *  - AuthSection composition renders SignUpText + AuthForm + social links.
 */
import { ApolloProvider } from '@apollo/client/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';

import AuthLayout from '@components/AuthSection/AuthForm/AuthLayout';
import AuthSection from '@components/AuthSection/AuthSection';
import { socialLinks } from '@components/AuthSection/constants';

import client from '../../../../src/features/landing/api/graphql/apollo';
import { SocialLink } from '../../../../src/features/landing/types/authentication/social';
import {
  FetchMock,
  graphqlData,
  graphqlErrors,
  installFetchMock,
  readGraphQLRequest,
  restoreFetch,
} from '../../utils/graphql-network';

const fullNamePlaceholder: string = t('sign_up.form.name_input.placeholder');
const emailPlaceholder: string = t('sign_up.form.email_input.placeholder');
const passwordPlaceholder: string = t('sign_up.form.password_input.placeholder');
const submitText: string = t('sign_up.form.button_text');
const successTitle: string = t('notifications.success.title');
const errorTitle: string = t('notifications.error.title');

const credentials = {
  fullName: 'Integration Tester',
  email: 'New.User@Example.com',
  password: 'Integration123',
};

function successPayload(email: string, initials: string): unknown {
  return {
    createUser: {
      user: { id: 'user-1', email, initials, confirmed: true, __typename: 'User' },
      clientMutationId: 'server-id',
      __typename: 'createUserPayload',
    },
  };
}

function fillAndSubmit(): void {
  fireEvent.change(screen.getByPlaceholderText(fullNamePlaceholder), {
    target: { value: credentials.fullName },
  });
  fireEvent.change(screen.getByPlaceholderText(emailPlaceholder), {
    target: { value: credentials.email },
  });
  fireEvent.change(screen.getByPlaceholderText(passwordPlaceholder), {
    target: { value: credentials.password },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: submitText }));
}

describe('integration: AuthLayout', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = installFetchMock();
  });

  afterEach(async () => {
    restoreFetch();
    await client.clearStore();
  });

  function renderLayout(): void {
    render(
      <ApolloProvider client={client}>
        <AuthLayout />
      </ApolloProvider>
    );
  }

  it('initially renders the hidden success notification and no error', () => {
    renderLayout();

    expect(screen.getByText(successTitle)).not.toBeVisible();
    expect(screen.queryByText(errorTitle)).not.toBeInTheDocument();
  });

  it('shows the loader, lower-cases the email, resets the form and shows success', async () => {
    const expectedEmail: string = credentials.email.toLowerCase();
    // Defer the response so the in-flight `loading` branch (the spinner) is
    // observable before it resolves.
    let resolveFetch: (response: Response) => void = () => {};
    const pending: Promise<Response> = new Promise<Response>(resolve => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pending as ReturnType<typeof fetch>);

    renderLayout();
    fillAndSubmit();

    // While the mutation is in flight the `loading` branch renders the spinner
    // (an `output` element with the accessible name "Loading").
    await waitFor(() => expect(screen.queryByLabelText('Loading')).toBeInTheDocument());

    resolveFetch(graphqlData(successPayload(expectedEmail, credentials.fullName)));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
      expect(screen.getByText(successTitle)).toBeVisible();
      expect(screen.queryByText(errorTitle)).not.toBeInTheDocument();
    });

    // useFormReset clears the inputs after a successful submit.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue('');
      expect(screen.getByPlaceholderText(fullNamePlaceholder)).toHaveValue('');
      expect(screen.getByPlaceholderText(passwordPlaceholder)).toHaveValue('');
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    const request = readGraphQLRequest(fetchMock);
    const input = request.body.variables.input as Record<string, string>;
    expect(input.email).toBe(expectedEmail);
    expect(input.initials).toBe(credentials.fullName);
    expect(input.password).toBe(credentials.password);
    expect(input.clientMutationId.length).toBeGreaterThan(0);
  });

  it('shows the error notification and keeps the form data when the API rejects', async () => {
    fetchMock.mockResolvedValue(
      graphqlErrors([
        {
          message: 'A user with this email already exists.',
          extensions: { code: 'BAD_USER_INPUT' },
        },
      ])
    );

    renderLayout();
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(errorTitle)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The error branch must NOT reset the form (useFormReset only clears on success).
    expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue(credentials.email);
    expect(screen.getByPlaceholderText(fullNamePlaceholder)).toHaveValue(credentials.fullName);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('retries the mutation when the retry button is clicked after an error', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlErrors([
        { message: 'Internal Server Error.', extensions: { code: 'INTERNAL_SERVER_ERROR' } },
      ])
    );

    renderLayout();
    fillAndSubmit();

    const retryButton: HTMLElement = await screen.findByRole('button', {
      name: t('notifications.error.retry_button'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      graphqlData(successPayload(credentials.email.toLowerCase(), credentials.fullName))
    );
    fireEvent.click(retryButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(successTitle)).toBeVisible());
  });
});

describe('integration: AuthSection composition', () => {
  afterEach(async () => {
    await client.clearStore();
  });

  it('renders the sign-up text, the form and every social link', () => {
    const { container } = render(
      <ApolloProvider client={client}>
        <AuthSection />
      </ApolloProvider>
    );

    expect(container.querySelector('section')).toBeInTheDocument();
    expect(screen.getByText(t('sign_up.vilna_text'))).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();

    socialLinks.forEach(({ title }: SocialLink) => {
      expect(screen.getByText(t(title))).toBeInTheDocument();
    });
  });
});
