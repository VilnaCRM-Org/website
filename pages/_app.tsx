import { ApolloProvider } from '@apollo/client';
import { ThemeProvider } from '@mui/material/styles';
import { GoogleAnalytics } from '@next/third-parties/google';
import * as Sentry from '@sentry/react';
import React, { useEffect } from 'react';

import { theme } from '@/components/AppTheme';
import Layout from '@/components/Layout';
import { golos } from '@/config/Fonts/golos';

import 'swagger-ui-react/swagger-ui.css';

import '../styles/global.css';

import 'src/features/swagger/components/ApiDocumentation/styles.scss';

import i18n from '../i18n';
import client from '../src/features/landing/api/graphql/apollo';

Sentry.init({
  dsn: process.env.SENTRY_DSN_KEY,
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracePropagationTargets: [
    process.env.NEXT_PUBLIC_DEVELOPMENT_API_URL || '',
    process.env.NEXT_PUBLIC_API_URL || '',
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

function MyApp({ Component }: { Component: React.ComponentType }): React.ReactElement {
  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <ApolloProvider client={client}>
        <main className={golos.className}>
          <Layout>
            <Component />
          </Layout>
          <GoogleAnalytics gaId="G-XYZ" />
        </main>
      </ApolloProvider>
    </ThemeProvider>
  );
}

export default MyApp;
