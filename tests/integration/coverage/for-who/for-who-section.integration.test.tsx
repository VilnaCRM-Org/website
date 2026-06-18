/**
 * Integration coverage for the ForWhoSection feature subtree.
 *
 * Renders the REAL `ForWhoSection` (and, via the barrels, its `Cards` and
 * `MainTitle` children) inside the integration jsdom-fetch environment with
 * i18next initialised by `jest.setup.ts`. The section pulls optimized image
 * props through `next-export-optimize-images/image`, so this exercises the
 * whole render path end-to-end rather than with the image layer stubbed.
 */
import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ForWhoSectionBarrel from '../../../../src/features/landing/components/ForWhoSection';
import ForWhoSection from '../../../../src/features/landing/components/ForWhoSection/ForWhoSection';

const forWhoButton: string = t('for_who.button_text');
const forWhoTitle: string = t('for_who.heading_main');
const vectorAlt: string = t('for_who.vector_alt');

describe('ForWhoSection integration', () => {
  it('re-exports the section from its barrel', () => {
    expect(ForWhoSectionBarrel).toBe(ForWhoSection);
  });

  it('renders the main title heading', () => {
    const { getByText } = render(React.createElement(ForWhoSection));

    expect(getByText(forWhoTitle)).toBeInTheDocument();
  });

  it('renders three sign up CTAs as links without nested button semantics', () => {
    const { getAllByText, queryAllByRole } = render(React.createElement(ForWhoSection));

    expect(getAllByText(forWhoButton)).toHaveLength(3);
    getAllByText(forWhoButton).forEach(element => {
      expect(element.closest('a')).toHaveAttribute('href', '#signUp');
    });
    expect(queryAllByRole('button', { name: forWhoButton })).toHaveLength(0);
  });

  it('renders decorative images with empty alt text and labelled vector images', () => {
    const { getAllByAltText } = render(React.createElement(ForWhoSection));

    expect(getAllByAltText('')).toHaveLength(9);
    expect(getAllByAltText(vectorAlt)).toHaveLength(4);
  });
});
