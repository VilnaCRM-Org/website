import dynamic from 'next/dynamic';
import Head from 'next/head';
import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

const DynamicUiFooter: ComponentType = dynamic(() => import('../UiFooter'), {
  ssr: false,
});

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
      {header}
      {children}
      <DynamicUiFooter />
    </>
  );
}
