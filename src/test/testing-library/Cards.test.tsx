import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import Cards from '../../features/landing/components/ForWhoSection/Cards/Cards';

const cardTitle: string = t('for_who.card_text_title');
const cardText: string = t('for_who.heading_secondary');
const cardBusinessText: string = t('for_who.card_text_business');
const cardButton: string = t('for_who.button_text');
const forWhoImage: string = t('for_who.vector_alt');
const forWhoAriaLabel: string = t('for_who.aria_label');

describe('Cards component', () => {
  it('renders secondary title correctly', () => {
    const { getByText, getAllByAltText, getByLabelText } = render(<Cards />);

    expect(getAllByAltText(forWhoImage)[0]).toBeInTheDocument();
    expect(getAllByAltText(forWhoImage)[1]).toBeInTheDocument();
    expect(getByLabelText(forWhoAriaLabel)).toBeInTheDocument();
    expect(getByText(cardTitle)).toBeInTheDocument();
  });

  it('renders secondary text correctly', () => {
    const { getByText } = render(<Cards />);
    expect(getByText(cardText)).toBeInTheDocument();
  });

  it('renders card items correctly', () => {
    const { getByText } = render(<Cards />);
    expect(getByText(cardBusinessText)).toBeInTheDocument();
  });

  it('renders button correctly', () => {
    const { getByText } = render(<Cards />);
    expect(getByText(cardButton)).toBeInTheDocument();
  });
});
