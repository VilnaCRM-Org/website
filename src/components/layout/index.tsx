import dynamic from 'next/dynamic';
import Head from 'next/head';
import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import UiSkipLink from '../ui-skip-link';

const DynamicUiFooter: ComponentType = dynamic(() => import('../ui-footer'), {
  ssr: false,
});

const SKIP_TARGET_ID: string = 'skip-target';

export default function Layout({
  children,
  header,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <Head>
        <title>{t('header.layout.page_title')}</title>
        <meta name="description" content={t('header.layout.meta_description')} />
      </Head>
      <UiSkipLink label={t('header.layout.skip_to_content')} targetId={SKIP_TARGET_ID} />
      {header}
      <span id={SKIP_TARGET_ID} tabIndex={-1} />
      {children}
      <DynamicUiFooter />
    </>
  );
}
