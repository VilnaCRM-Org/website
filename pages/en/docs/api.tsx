import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';
import Seo from '@/components/seo';

export default function ApiDocsEnPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 4 }}>
      {/* `noindex`, and absent from public/sitemap.xml: this page is still the placeholder
          stub #339 records, and asking a crawler to index a stub competes with /swagger —
          the page that carries the real API reference — for the same query. Both the tag
          and the sitemap exclusion come off in the change that gives it real content. */}
      <Seo
        title={t('seo.api_docs.title')}
        description={t('seo.api_docs.description')}
        path="/en/docs/api"
        noindex
      />
      <UiTypography component="h1" variant="h1">
        API Documentation (EN)
      </UiTypography>
      <UiTypography>This is the English version of the API documentation page.</UiTypography>
    </Box>
  );
}
