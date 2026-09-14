import { ApolloClient, ApolloLink, InMemoryCache, HttpLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import i18n from 'i18next';

import { env } from '@/config/env';

const acceptLanguageLink: ApolloLink = new SetContextLink(() => ({
  headers: {
    'Accept-Language': i18n.language || 'en-US',
  },
}));

const httpLink: ApolloLink = new HttpLink({
  uri: env.NEXT_PUBLIC_GRAPHQL_API_URL,
});

const client = new ApolloClient({
  link: ApolloLink.from([acceptLanguageLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;
