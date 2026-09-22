import { ApolloClient, ApolloLink, InMemoryCache, HttpLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import i18n from 'i18next';

import { env } from '@/config/env';
import { reportHandledError } from '@/lib/telemetry/report-error';

const acceptLanguageLink: ApolloLink = new SetContextLink(() => ({
  headers: {
    'Accept-Language': i18n.language || 'en-US',
  },
}));

const errorLink: ApolloLink = new ErrorLink(({ error }) => {
  reportHandledError(error, { feature: 'landing', action: 'graphql' });
});

const httpLink: ApolloLink = new HttpLink({
  uri: env.NEXT_PUBLIC_GRAPHQL_API_URL,
});

const client = new ApolloClient({
  link: ApolloLink.from([errorLink, acceptLanguageLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;
