import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import i18n from '../i18n';

Sentry.init({
  dsn: process.env.SENTRY_DSN_KEY,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [process.env.LOCALHOST, /^https:\/\/yourserver\.io\/api/],
    }),
    new Sentry.Replay(),
  ],
  replaysOnErrorSampleRate: 1.0,
});

// eslint-disable-next-line react/prop-types
function MyApp({ Component, pageProps }) {
  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, []);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Component {...pageProps} />;
}

export default MyApp;
