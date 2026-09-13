import { SITE_ORIGIN, absoluteUrl } from '@/config/site';

export interface SiteStructuredDataOptions {
  readonly name: string;
  readonly description: string;
}

const ORGANIZATION_ID: string = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID: string = `${SITE_ORIGIN}/#website`;

function serialize(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

export function buildSiteStructuredData({ name, description }: SiteStructuredDataOptions): string {
  return serialize({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name,
        url: absoluteUrl('/'),
        logo: absoluteUrl('/layout/favicon/512x512.svg'),
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name,
        description,
        url: absoluteUrl('/'),
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  });
}
