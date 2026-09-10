import { SITE_ORIGIN, absoluteUrl } from '@/config/site';

/**
 * Schema.org JSON-LD for the site itself (issue #339).
 *
 * Two nodes in one `@graph`, which is how a single script tag expresses more
 * than one entity: `Organization` (who publishes the site) and `WebSite` (the
 * site as a work). They are cross-referenced by `@id` rather than nested, so a
 * consumer that only understands one of them still reads a complete node.
 *
 * `sameAs` is deliberately absent. It is the property that links this
 * `Organization` to its profiles on other services, and a search engine treats
 * it as an identity claim — pointing it at the placeholder profile URLs the site
 * still carries (`src/config/social-links.ts` holds bare `instagram.com` /
 * `facebook.com` / `linkedin.com` homepages, tracked in #327) would publish a
 * claim that is simply false. It is added in the same change that replaces those
 * placeholders with real profiles, not before.
 */
export interface SiteStructuredDataOptions {
  readonly name: string;
  readonly description: string;
}

const ORGANIZATION_ID: string = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID: string = `${SITE_ORIGIN}/#website`;

/**
 * Serialize for embedding inside a `<script>` element.
 *
 * `JSON.stringify` leaves `<` alone, so a value containing `</script` would
 * close the element early and turn the rest of the document into markup. `\u003c`
 * is the same character to a JSON parser and inert to an HTML tokenizer, which
 * is what makes the embedded document safe regardless of what the copy contains.
 */
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
