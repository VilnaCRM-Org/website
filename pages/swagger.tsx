import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { SwaggerPage } from '@/features/swagger';

export default function Swagger(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('seo.swagger.title')}
        description={t('seo.swagger.description')}
        path="/swagger"
      />
      <SwaggerPage />
    </>
  );
}
