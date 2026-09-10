import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiLink, UiTypography } from '@/components';
import Seo from '@/components/seo';

/**
 * Branded 404 document (issue #339), exported to `out/404.html`.
 *
 * Next.js emits a 404 document for every build; until this file existed it emitted the
 * framework's own unbranded, English-only default. Rendering it from `pages/` puts it
 * inside the shared Layout, so a visitor who mistypes a URL keeps the site header, footer
 * and language instead of landing on a page that looks like a different site.
 *
 * It is `noindex` and absent from `public/sitemap.xml`: a 404 body is an error report, and
 * an indexed copy of one is only ever a dead search result.
 *
 * `scripts/cloudfront_routing.js` does NOT rewrite unknown URIs to this document. A
 * CloudFront Functions viewer-request handler can only rewrite the URI or return a
 * response of its own, and a rewrite would serve this page with a `200` — the "soft 404"
 * that tells a crawler the address is a real page. The edge therefore keeps returning a
 * synthetic response carrying the real `404` status (asserted on every deploy by
 * `scripts/ci/smoke-response-shape.sh`), and this document is what S3 serves as the
 * bucket's error document and what the dev server renders.
 */
export default function NotFound(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('not_found.title')}
        description={t('not_found.description')}
        path="/404"
        noindex
      />
      <Box sx={{ maxWidth: '34rem', mx: 'auto', px: 3, py: 8, textAlign: 'center' }}>
        <UiTypography component="h1" variant="h2">
          {t('not_found.heading')}
        </UiTypography>
        <UiTypography sx={{ mt: 2, mb: 4 }}>{t('not_found.hint')}</UiTypography>
        <UiLink href="/">{t('not_found.home_link')}</UiLink>
      </Box>
    </>
  );
}
