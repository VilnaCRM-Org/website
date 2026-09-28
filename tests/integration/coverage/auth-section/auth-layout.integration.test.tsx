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
 *  - honeypot: a filled trap never reaches fetch, yet the UI answers as success
 *    and the form resets — the response a script cannot tell from a real one.
 *  - in-flight lock (#380): a second submit or retry that lands before the
 *    `loading` render issues no request and leaves the entries in place.
 *  - AuthSection composition renders SignUpText + AuthForm + social links.
 */
import { ApolloProvider } from '@apollo/client/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';

import AuthLayout from '@landing/auth-section/auth-form/auth-layout';
import AuthSection from '@landing/auth-section/auth-section';
import { socialLinks } from '@landing/auth-section/constants';

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
const confirmPasswordPlaceholder: string = t('sign_up.form.confirm_password_input.placeholder');
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

function signedUpResponse(): Response {
  return graphqlData(successPayload(credentials.email.toLowerCase(), credentials.fullName));
}

function deferFetch(fetchMock: FetchMock): (response: Response) => void {
  let resolveFetch: (response: Response) => void = () => {};
  const pending: Promise<Response> = new Promise<Response>(resolve => {
    resolveFetch = resolve;
  });
  fetchMock.mockReturnValueOnce(pending as ReturnType<typeof fetch>);
  return (response: Response): void => resolveFetch(response);
}

function settle(): Promise<void> {
  return act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(resolve, 50);
    });
  });
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
  fireEvent.change(screen.getByPlaceholderText(confirmPasswordPlaceholder), {
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

  it('answers a filled honeypot like a success without ever calling fetch', async () => {
    renderLayout();
    const honeypot: HTMLInputElement | null = document.querySelector('input[name="Referral"]');
    expect(honeypot).not.toBeNull();
    fireEvent.change(honeypot!, { target: { value: 'https://spam.example' } });

    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(successTitle)).toBeVisible());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(errorTitle)).not.toBeInTheDocument();
    // The same reset a real success triggers, so the trip is indistinguishable.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue('');
      expect(honeypot).toHaveValue('');
    });
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
      expect(screen.getByPlaceholderText(confirmPasswordPlaceholder)).toHaveValue('');
      expect(screen.getByRole('checkbox')).not.toBeChecked();
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
    expect(input.clientMutationId.length).toBeGreaterThan(0);
    // Exact key set, not just the expected fields: `ConfirmPassword` is a
    // client-side typo guard and must never reach the server (#382 F4).
    expect(Object.keys(input).sort()).toEqual([
      'clientMutationId',
      'email',
      'initials',
      'password',
    ]);
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

  it('issues one createUser and keeps the entries when the form is submitted twice', async () => {
    const resolveFetch = deferFetch(fetchMock);

    renderLayout();
    fillAndSubmit();
    fireEvent.click(screen.getByRole('button', { name: submitText }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue(credentials.email);
    expect(screen.getByPlaceholderText(passwordPlaceholder)).toHaveValue(credentials.password);
    expect(screen.getByRole('checkbox')).toBeChecked();

    resolveFetch(signedUpResponse());

    await waitFor(() => expect(screen.getByText(successTitle)).toBeVisible());
    await waitFor(() => expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue(''));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('issues one retry when retry is clicked twice and then the form is submitted', async () => {
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
    const resolveRetry = deferFetch(fetchMock);

    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    fireEvent.click(screen.getByRole('button', { name: submitText, hidden: true }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(emailPlaceholder)).toHaveValue(credentials.email);

    resolveRetry(signedUpResponse());

    await waitFor(() => expect(screen.getByText(successTitle)).toBeVisible());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('submits again once the previous submission has settled', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlErrors([{ message: 'Bad input.', extensions: { code: 'BAD_USER_INPUT' } }])
    );

    renderLayout();
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText(errorTitle)).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument());
    fetchMock.mockResolvedValueOnce(signedUpResponse());

    fireEvent.click(screen.getByRole('button', { name: submitText, hidden: true }));

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
