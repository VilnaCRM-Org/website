import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { useTranslation } from 'react-i18next';

import colorTheme from '@/components/ui-color-theme';

/**
 * Offline fallback document (issue #338), exported to `out/offline.html` and precached by
 * `public/sw.js`.
 *
 * Reached only as `/offline.html`, and only from inside the worker's `respondWith` — never
 * by navigation. The CloudFront edge function hard-404s the extensionless `/offline`, and
 * serving from cache keeps the address bar on the URL the visitor actually asked for. It is
 * `noindex` because it is a network artefact, not content.
 *
 * Styled with inline `style` objects rather than MUI `sx`. By definition this document is
 * served while the network is down, so neither the emotion runtime nor the extracted
 * `_next/static` CSS bundle can load — anything that needs JavaScript or a stylesheet
 * request would render as unstyled markup. Inline attributes are serialized into the
 * exported HTML itself, so they are the only styling that survives. The colour values are
 * still read from the shared theme so they cannot drift from the rest of the site.
 */

const pageStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  margin: '0 auto',
  maxWidth: '34rem',
  padding: '4rem 1.5rem',
  textAlign: 'center',
  color: colorTheme.palette.darkPrimary.main,
  // The Golos webfont is a `_next/static` request that cannot resolve offline, so the stack
  // names only faces the operating system already has.
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  lineHeight: 1.5,
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.75rem',
  fontWeight: 600,
};

const descriptionStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1rem',
};

const hintStyle: React.CSSProperties = {
  margin: '0 0 2rem',
  fontSize: '0.9375rem',
  color: colorTheme.palette.grey250.main,
};

const linkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  backgroundColor: colorTheme.palette.primary.main,
  color: colorTheme.palette.white.main,
  fontSize: '1rem',
  fontWeight: 600,
  textDecoration: 'none',
};

export default function Offline(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={pageStyle}>
        <h1 style={headingStyle}>{t('offline.heading')}</h1>
        <p style={descriptionStyle}>{t('offline.description')}</p>
        <p style={hintStyle}>{t('offline.hint')}</p>
        {/* A link, not a button: no JavaScript runs in this document, so a control that
            needs a click handler would be dead. `Link` renders a plain `<a href="/">` into
            the exported HTML, so the navigation works with the runtime absent. */}
        <Link href="/" style={linkStyle}>
          {t('offline.home_link')}
        </Link>
      </div>
    </>
  );
}
