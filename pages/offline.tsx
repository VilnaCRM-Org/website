import React from 'react';
import { useTranslation } from 'react-i18next';

import Seo from '@/components/seo';
import { OfflineShell } from '@/features/offline';

export default function Offline(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Seo
        title={t('offline.heading')}
        description={t('offline.description')}
        path="/offline"
        noindex
      />
      <OfflineShell />
    </>
  );
}
