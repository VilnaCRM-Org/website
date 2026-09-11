import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { ApiDocs } from '@/features/documentation';

export default function ApiDocsEnPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('seo.api_docs.title')}
        description={t('seo.api_docs.description')}
        path="/en/docs/api"
        noindex
      />
      <ApiDocs />
    </>
  );
}
