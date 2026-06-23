/**
 * Integration coverage for the `Cards` sub-component of ForWhoSection and its
 * barrel re-export. Rendered standalone with i18next from `jest.setup.ts`.
 */
import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { Cards as CardsBarrel } from '@components/ForWhoSection/Cards';
import Cards from '@components/ForWhoSection/Cards/Cards';

const cardTitle: string = t('for_who.card_text_title');
const secondaryHeading: string = t('for_who.heading_secondary');
const businessText: string = t('for_who.card_text_business');
const cardButton: string = t('for_who.button_text');
const vectorAlt: string = t('for_who.vector_alt');

describe('Cards integration', () => {
  it('re-exports Cards from its barrel', () => {
    expect(CardsBarrel).toBe(Cards);
  });

  it('renders the secondary heading and both option texts', () => {
    const { getByText } = render(React.createElement(Cards));

    expect(getByText(secondaryHeading)).toBeInTheDocument();
    expect(getByText(cardTitle)).toBeInTheDocument();
    expect(getByText(businessText)).toBeInTheDocument();
  });

  it('renders both labelled vector images', () => {
    const { getAllByAltText } = render(React.createElement(Cards));

    expect(getAllByAltText(vectorAlt)).toHaveLength(2);
  });

  it('renders the CTA as a link without nested button semantics', () => {
    const { getByText, queryByRole } = render(React.createElement(Cards));

    expect(getByText(cardButton).closest('a')).toHaveAttribute('href', '#signUp');
    expect(queryByRole('button', { name: cardButton })).not.toBeInTheDocument();
  });
});
