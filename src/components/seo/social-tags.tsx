import React from 'react';

import { SocialTagOptions } from './types';

export function socialMetaTags({
  title,
  description,
  url,
  siteName,
  locale,
}: SocialTagOptions): React.ReactElement[] {
  return [
    <meta key="og:type" property="og:type" content="website" />,
    <meta key="og:site_name" property="og:site_name" content={siteName} />,
    <meta key="og:locale" property="og:locale" content={locale} />,
    <meta key="og:title" property="og:title" content={title} />,
    <meta key="og:description" property="og:description" content={description} />,
    <meta key="og:url" property="og:url" content={url} />,
    <meta key="twitter:card" name="twitter:card" content="summary" />,
    <meta key="twitter:title" name="twitter:title" content={title} />,
    <meta key="twitter:description" name="twitter:description" content={description} />,
  ];
}
