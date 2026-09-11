import { act, render, RenderResult } from '@testing-library/react';
import i18n, { t } from 'i18next';
import React from 'react';
import '@testing-library/jest-dom';

import Seo from '@/components/seo';
import { SITE_ORIGIN } from '@/config/site';

/**
 * The shared per-page SEO head (issue #339).
 *
 * `next/head` is replaced with a passthrough so the tags render into the test DOM: the real
 * component defers them to Next's head manager, which does nothing outside a Next runtime,
 * and asserting on the manager instead of the tags would test the framework rather than
 * this component. React itself hoists `<title>`/`<meta>`/`<link>` to `document.head`, so
 * every lookup checks both places.
 *
 * Locale — covered: the `og:locale` cases below drive the mapped and the unmapped branch.
 * Permission / auth — Not applicable: static marketing metadata, no authenticated state.
 * Loading / error — Not applicable: the component is synchronous with no async boundary.
 */
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));

const REQUIRED_PROPS = {
  title: 'Test title',
  description: 'Test description',
  path: '/swagger',
} as const;

function renderSeo(overrides: Partial<React.ComponentProps<typeof Seo>> = {}): RenderResult {
  return render(<Seo {...REQUIRED_PROPS} {...overrides} />);
}

function find(selector: string): Element | null {
  return document.querySelector(selector);
}

function contentOf(selector: string): string | null {
  return find(selector)?.getAttribute('content') ?? null;
}

describe('Seo', () => {
  const initialLanguage: string = i18n.language;

  afterEach(async () => {
    // The locale cases switch the shared i18next instance; leaving it switched would make
    // every later assertion depend on the order the cases ran in. The rendered tags need no
    // cleanup of their own: React hoists them into `document.head` and removes them again
    // when Testing Library unmounts the tree.
    await act(async () => {
      await i18n.changeLanguage(initialLanguage);
    });
  });

  it('renders the page title and description it is given', () => {
    renderSeo();

    expect(document.querySelector('title')?.textContent).toBe(REQUIRED_PROPS.title);
    expect(contentOf('meta[name="description"]')).toBe(REQUIRED_PROPS.description);
  });

  it('declares a canonical URL on the production origin', () => {
    renderSeo();

    expect(find('link[rel="canonical"]')?.getAttribute('href')).toBe(`${SITE_ORIGIN}/swagger`);
  });

  it('mirrors the title, description and URL into Open Graph', () => {
    renderSeo();

    expect(contentOf('meta[property="og:type"]')).toBe('website');
    expect(contentOf('meta[property="og:title"]')).toBe(REQUIRED_PROPS.title);
    expect(contentOf('meta[property="og:description"]')).toBe(REQUIRED_PROPS.description);
    expect(contentOf('meta[property="og:url"]')).toBe(`${SITE_ORIGIN}/swagger`);
    expect(contentOf('meta[property="og:site_name"]')).toBe(t('seo.site_name'));
  });

  it('declares a Twitter card carrying the same copy', () => {
    renderSeo();

    expect(contentOf('meta[name="twitter:card"]')).toBe('summary');
    expect(contentOf('meta[name="twitter:title"]')).toBe(REQUIRED_PROPS.title);
    expect(contentOf('meta[name="twitter:description"]')).toBe(REQUIRED_PROPS.description);
  });

  it('declares no image tag while the repository ships no share card', () => {
    renderSeo();

    // A card pointing at a 180px touch icon renders worse than the text-only fallback, and
    // one pointing at a file the export does not contain renders as a broken image.
    expect(find('meta[property="og:image"]')).toBeNull();
    expect(find('meta[name="twitter:image"]')).toBeNull();
  });

  it.each([
    ['uk', 'uk_UA'],
    ['en', 'en_US'],
    ['en-GB', 'en_US'],
  ])('maps the %s locale to the Open Graph %s form', async (language, expected) => {
    await act(async () => {
      await i18n.changeLanguage(language);
    });
    renderSeo();

    expect(contentOf('meta[property="og:locale"]')).toBe(expected);
  });

  it('falls back to the bare language subtag for a locale it does not know', async () => {
    // A wrong-but-well-formed guess (defaulting every unknown language to en_US) would
    // mislabel the document; the subtag is at least true.
    await act(async () => {
      await i18n.changeLanguage('pl');
    });
    renderSeo();

    expect(contentOf('meta[property="og:locale"]')).toBe('pl');
  });

  it('is indexable by default and noindex on request', () => {
    const { unmount }: RenderResult = renderSeo();
    expect(find('meta[name="robots"]')).toBeNull();
    unmount();

    renderSeo({ noindex: true });
    expect(contentOf('meta[name="robots"]')).toBe('noindex');
  });

  it('never pairs a canonical link with noindex', () => {
    renderSeo({ noindex: true });

    // Nominating an index URL while asking not to be indexed is two contradictory
    // instructions, and which one a search engine honours is its own choice.
    expect(find('link[rel="canonical"]')).toBeNull();
  });

  it('emits the site-level JSON-LD graph only when asked for it', () => {
    const { unmount }: RenderResult = renderSeo();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    unmount();

    renderSeo({ siteSchema: true });
    const script: Element | null = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const graph: { '@graph': { '@type': string; url: string }[] } = JSON.parse(
      script?.textContent ?? ''
    ) as { '@graph': { '@type': string; url: string }[] };
    expect(graph['@graph'].map(node => node['@type'])).toEqual(['Organization', 'WebSite']);
    for (const node of graph['@graph']) {
      expect(node.url).toBe(`${SITE_ORIGIN}/`);
    }
  });
});
