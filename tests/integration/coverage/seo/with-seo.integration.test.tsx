/**
 * Integration coverage for `withSeo` (`src/components/seo/with-seo.tsx`), the page factory
 * every route under `pages/` is built from: it resolves the title and description keys
 * through i18n, renders `Seo` with the page's spec, and then the feature body.
 *
 * Both sides of each optional flag are driven — `noindex` on and off (robots vs canonical),
 * `siteSchema` on and off (the JSON-LD script present or absent) — because the factory
 * defaults them, and the integration sweep gates every branch.
 *
 * `next/head` is a passthrough for the same reason as in `seo.integration.test.tsx`.
 * Permission / auth — Not applicable: static metadata. Loading / error — Not applicable:
 * synchronous render.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import withSeo from '@/components/seo/with-seo';
import { SITE_ORIGIN } from '@/config/site';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));

function Body(): React.ReactElement {
  return <main>page body</main>;
}

describe('integration: withSeo', () => {
  it('renders the localized head for the page and then its body', () => {
    const Page = withSeo(
      {
        titleKey: 'seo.swagger.title',
        descriptionKey: 'seo.swagger.description',
        path: '/swagger',
      },
      Body
    );

    render(<Page />);

    expect(document.querySelector('title')?.textContent).toBe(t('seo.swagger.title'));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      t('seo.swagger.description')
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_ORIGIN}/swagger`
    );
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page body');
  });

  it('marks a noindex page and declares the site graph when the spec asks for them', () => {
    const Page = withSeo(
      {
        titleKey: 'not_found.title',
        descriptionKey: 'not_found.description',
        path: '/404',
        noindex: true,
        siteSchema: true,
      },
      Body
    );

    render(<Page />);

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex'
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });
});
