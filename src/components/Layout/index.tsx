import dynamic from 'next/dynamic';
import Head from 'next/head';
import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

const DynamicUiFooter: ComponentType = dynamic(() => import('../UiFooter'), {
  ssr: false,
});

const DynamicHeader: ComponentType = dynamic(() => import('../../features/landing/components/Header'), { ssr: false });

export default function Layout({ children }: { children: Array<React.ReactNode> | React.ReactNode}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <Head>
        <title>{t('VilnaCRM API')}</title>
        <meta name="description" content={t('The first Ukrainian open source CRM')} />
        <link rel="apple-touch-icon" href="../../assets/img/touch.png" />
      </Head>
      <DynamicHeader />
      {children}
      <DynamicUiFooter />
    </>
  );
}
