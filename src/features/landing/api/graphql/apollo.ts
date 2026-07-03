import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import i18n from 'i18next';

import { env } from '@/config/env';

const { language } = i18n;

const httpLink = new HttpLink({
  uri: env.NEXT_PUBLIC_GRAPHQL_API_URL,
  headers: {
    'Accept-Language': language || 'en-US',
  },
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

export default client;
