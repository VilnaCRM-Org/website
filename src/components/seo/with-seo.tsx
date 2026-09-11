import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { SeoPageSpec } from './types';

import Seo from '.';

export default function withSeo(spec: SeoPageSpec, Body: ComponentType): () => React.ReactElement {
  function SeoPage(): React.ReactElement {
    const { t } = useTranslation();

    return (
      <>
        <Seo
          title={t(spec.titleKey)}
          description={t(spec.descriptionKey)}
          path={spec.path}
          noindex={spec.noindex ?? false}
          siteSchema={spec.siteSchema ?? false}
        />
        <Body />
      </>
    );
  }

  return SeoPage;
}
