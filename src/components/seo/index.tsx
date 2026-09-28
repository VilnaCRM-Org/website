import Head from 'next/head';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { LocaleAlternate } from '@/config/locales';
import { absoluteUrl } from '@/config/site';

import { socialMetaTags } from './social-tags';
import { buildSiteStructuredData } from './structured-data';
import { SeoProps } from './types';

const OG_LOCALES: Readonly<Record<string, string>> = {
  en: 'en_US',
  uk: 'uk_UA',
};

function ogLocaleOf(language: string): string {
  return OG_LOCALES[language.toLowerCase().replace(/-.*$/, '')] ?? language.toLowerCase();
}

function alternateLinks(alternates: readonly LocaleAlternate[]): React.ReactElement[] {
  return alternates.map(({ hreflang, path }) => (
    <link
      key={`alternate-${hreflang}`}
      rel="alternate"
      hrefLang={hreflang}
      href={absoluteUrl(path)}
    />
  ));
}

function structuredDataTag(name: string, description: string): React.ReactElement {
  return (
    <script type="application/ld+json">{buildSiteStructuredData({ name, description })}</script>
  );
}

export default function Seo({
  title,
  description,
  path,
  noindex = false,
  siteSchema = false,
  alternates = [],
}: SeoProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const url: string = absoluteUrl(path);
  const siteName: string = t('seo.site_name');

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}
      {alternateLinks(alternates)}
      {socialMetaTags({ title, description, url, siteName, locale: ogLocaleOf(i18n.language) })}
      {siteSchema ? structuredDataTag(siteName, description) : null}
    </Head>
  );
}
