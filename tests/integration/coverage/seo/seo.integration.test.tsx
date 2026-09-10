/**
 * Integration coverage for the SEO head (`src/components/seo`, `src/config/site.ts`, #339).
 *
 * The registration flow the rest of this layer drives never renders a page shell, so the
 * per-page metadata would otherwise reach the integration layer's 100% sweep uncovered.
 * These tests drive both sides of every branch the component has — indexable vs `noindex`,
 * with and without the site-level JSON-LD graph, a mapped locale and an unmapped one — and
 * the guard on `absoluteUrl`.
 *
 * `next/head` is a passthrough here for the same reason as in the unit spec: outside a Next
 * runtime the real one renders nothing, so the assertions would be on the framework's head
 * manager rather than on the tags this component produces.
 *
 * Permission / auth — Not applicable: static marketing metadata, no authenticated state.
 * Loading / error — Not applicable: synchronous render with no async boundary.
 */
import { act, render } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';

import Seo from '@/components/seo';
import { SITE_ORIGIN, absoluteUrl } from '@/config/site';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));

function metaContent(selector: string): string | null {
  return document.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('integration: SEO head', () => {
  const initialLanguage: string = i18n.language;

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage(initialLanguage);
    });
  });

  it('publishes the canonical, Open Graph and Twitter tags for a page', () => {
    render(<Seo title="Title" description="Description" path="/swagger" />);

    expect(document.querySelector('title')?.textContent).toBe('Title');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_ORIGIN}/swagger`
    );
    expect(metaContent('meta[property="og:url"]')).toBe(`${SITE_ORIGIN}/swagger`);
    expect(metaContent('meta[name="twitter:card"]')).toBe('summary');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('marks a page noindex and emits the site graph when asked', () => {
    render(<Seo title="Title" description="Description" path="/" noindex siteSchema />);

    expect(metaContent('meta[name="robots"]')).toBe('noindex');
    // Exclusive with the canonical link: two contradictory instructions otherwise.
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    const script: Element | null = document.querySelector('script[type="application/ld+json"]');
    const graph: { '@graph': { '@type': string }[] } = JSON.parse(script?.textContent ?? '') as {
      '@graph': { '@type': string }[];
    };
    expect(graph['@graph'].map(node => node['@type'])).toEqual(['Organization', 'WebSite']);
  });

  it('falls back to the bare subtag for a locale with no Open Graph mapping', async () => {
    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    render(<Seo title="Title" description="Description" path="/" />);

    expect(metaContent('meta[property="og:locale"]')).toBe('pl');
  });

  it('uses the mapped Open Graph locale for a language the site ships', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    render(<Seo title="Title" description="Description" path="/" />);

    expect(metaContent('meta[property="og:locale"]')).toBe('en_US');
  });

  it('refuses a path that would resolve against another host', () => {
    expect(absoluteUrl('/swagger')).toBe(`${SITE_ORIGIN}/swagger`);
    expect(() => absoluteUrl('https://other.test/x')).toThrow(/site-relative path/);
  });
});
