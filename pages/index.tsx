import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { LandingComponent } from '@/features/landing';

export default function Home(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      {/* The home page is the one page that declares the site-level JSON-LD graph:
          `Organization` and `WebSite` describe the site as a whole, so repeating them on
          every route would only restate the same two nodes. */}
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
