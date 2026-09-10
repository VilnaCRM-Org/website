import Head from 'next/head';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { absoluteUrl } from '@/config/site';

import { buildSiteStructuredData } from './structured-data';
import { SeoProps } from './types';

/**
 * Per-page SEO head for the static export (issue #339).
 *
 * Before this component the whole site shipped one generic `<title>`
 * ("VilnaCRM API", from `header.layout.page_title`) on every route, two
 * competing meta descriptions — one hardcoded English copy in
 * `pages/_document.tsx`, outside `next/head`'s dedupe, and one localized copy in
 * the shared Layout, so both rendered — and no canonical, Open Graph, Twitter
 * Card or structured data at all. A public marketing site was therefore
 * indistinguishable from its own API docs in a search result and rendered as a
 * bare link when shared.
 *
 * `src/components/layout` still declares the site-wide title and description, so
 * a route that renders no `Seo` is never title-less; this component OVERRIDES
 * them. That override is not incidental: `next/head` reverses the collected head
 * elements before de-duplicating, so for `<title>` and for a `<meta name>` the
 * LAST declaration wins, and a page renders as a child of Layout.
 *
 * Lives in `src/components` (shared) and imports nothing from `src/features`,
 * per the dependency-cruiser `no-shared-ui-to-features` boundary — the copy is
 * passed in by the page, which reads it from its own feature i18n bundle.
 */

// Open Graph wants a full locale, not a bare language subtag. The site ships the
// two locales its i18n bundles carry; an unrecognised value falls through to the
// language code itself rather than to a wrong-but-well-formed guess.
const OG_LOCALES: Readonly<Record<string, string>> = {
  en: 'en_US',
  uk: 'uk_UA',
};

function ogLocaleOf(language: string): string {
  // `replace` rather than `split(...)[0]`: under `noUncheckedIndexedAccess` the indexed
  // read is `string | undefined`, and the `?? language` needed to narrow it is a branch no
  // input can take — an unreachable branch is exactly what the integration layer's 100%
  // sweep fails on, and it would have to be excused rather than covered.
  const base: string = language.toLowerCase().replace(/-.*$/, '');
  return OG_LOCALES[base] ?? base;
}

export default function Seo({
  title,
  description,
  path,
  noindex = false,
  siteSchema = false,
}: SeoProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const canonical: string = absoluteUrl(path);
  const siteName: string = t('seo.site_name');

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? <meta name="robots" content="noindex" /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={ogLocaleOf(i18n.language)} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />

      {/*
        `summary`, not `summary_large_image`, and no `og:image`/`twitter:image`.
        The repository ships no designed share card — the largest raster asset it
        has is a 180px touch icon — and declaring an image URL that renders as a
        blurred favicon, or one that does not exist, produces a worse card than
        the text-only fallback. The tag pair upgrades in the change that adds a
        real 1200x630 asset.
      */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {siteSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: buildSiteStructuredData({ name: siteName, description }),
          }}
        />
      ) : null}
    </Head>
  );
}
