import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { NotFound } from '@/features/not-found';

export default function NotFoundPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('not_found.title')}
        description={t('not_found.description')}
        path="/404"
        noindex
      />
      <NotFound />
    </>
  );
}
