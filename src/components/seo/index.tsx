import Head from 'next/head';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { absoluteUrl } from '@/config/site';

import { socialMetaTags } from './social-tags';
import { buildSiteStructuredData } from './structured-data';
import { SeoProps } from './types';

/**
 * Per-page SEO head for the static export (issue #339).
 *
 * Before this component the whole site shipped one generic `<title>` ("VilnaCRM API",
 * from `header.layout.page_title`) on every route, two competing meta descriptions — one
 * hardcoded English copy in `pages/_document.tsx`, outside `next/head`'s dedupe, and one
 * localized copy in the shared Layout, so both rendered — and no canonical, Open Graph,
 * Twitter Card or structured data at all. A public marketing site was therefore
 * indistinguishable from its own API docs in a search result, and rendered as a bare link
 * when shared.
 *
 * `src/components/layout` still declares the site-wide title and description, so a route
 * that renders no `Seo` is never title-less; this component OVERRIDES them. That override
 * is not incidental: `next/head` reverses the collected head elements before
 * de-duplicating, so for `<title>` and for a `<meta name>` the LAST declaration wins, and
 * a page renders as a child of Layout.
 *
 * Canonical and `noindex` are deliberately EXCLUSIVE. A canonical link nominates the URL a
 * document should be indexed under, so declaring one on a page that also asks not to be
 * indexed hands a search engine two contradictory instructions and leaves the choice to
 * it. A `noindex` page states only that.
 *
 * Lives in `src/components` (shared) and imports nothing from `src/features`, per the
 * dependency-cruiser `no-shared-ui-to-features` boundary — the copy is passed in by the
 * page, which reads it from its own feature i18n bundle.
 */

// Open Graph wants a full locale, not a bare language subtag. The site ships the two
// locales its i18n bundles carry; an unrecognised value falls through to the language code
// itself rather than to a wrong-but-well-formed guess.
const OG_LOCALES: Readonly<Record<string, string>> = {
  en: 'en_US',
  uk: 'uk_UA',
};

function ogLocaleOf(language: string): string {
  // `replace` rather than `split(...)[0]`: under `noUncheckedIndexedAccess` the indexed
  // read is `string | undefined`, and the `?? language` needed to narrow it is a branch no
  // input can take — an unreachable branch is exactly what the integration layer's 100%
  // sweep fails on, and it would have to be excused rather than covered.
  return OG_LOCALES[language.toLowerCase().replace(/-.*$/, '')] ?? language.toLowerCase();
}

/**
 * The JSON-LD graph, as a text child rather than `dangerouslySetInnerHTML`.
 *
 * React does not HTML-escape the text content of a `<script>` element, and `next/head`
 * assigns a string child straight to `textContent`, so the JSON arrives at a parser
 * unaltered — no `&quot;` to corrupt it, and no dangerous-property finding to suppress.
 * What keeps it safe is `buildSiteStructuredData`, which escapes every `<` to its
 * `\u003c` JSON form: the same character to a JSON parser, inert to an HTML tokenizer, so
 * no value can close the element early and inject markup. React's own serializer escapes
 * a literal `</script` sequence as well, but that is defence in depth, not the guarantee —
 * it does not run for the client-side render.
 */
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
}: SeoProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const url: string = absoluteUrl(path);
  const siteName: string = t('seo.site_name');

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex" /> : <link rel="canonical" href={url} />}
      {socialMetaTags({ title, description, url, siteName, locale: ogLocaleOf(i18n.language) })}
      {siteSchema ? structuredDataTag(siteName, description) : null}
    </Head>
  );
}
