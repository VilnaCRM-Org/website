import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { LandingComponent } from '@/features/landing';

export default function Home(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('seo.landing.title')}
        description={t('seo.landing.description')}
        path="/"
        siteSchema
      />
      <LandingComponent />
    </>
  );
}
