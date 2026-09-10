import React from 'react';

import { SocialTagOptions } from './types';

/**
 * The Open Graph and Twitter Card tags for a page (issue #339).
 *
 * A plain function returning an ARRAY of elements, not a component. `next/head`
 * inspects the elements it is handed and turns each into a DOM node itself, so a
 * custom component among its children would be treated as a tag named after the
 * function; only real tags, fragments and arrays survive that pass. Keeping this
 * out of `Seo` is also what holds that function inside the
 * `config/metrics-policy.json` size and Halstead budgets.
 *
 * No `og:image` / `twitter:image`, and `summary` rather than `summary_large_image`:
 * the repository ships no designed share card — its largest raster asset is a 180px
 * touch icon — and a card pointing at a blurred favicon, or at a file the export does
 * not contain, renders worse than the text-only fallback. Both upgrade together in the
 * change that adds a real 1200x630 asset.
 */
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
