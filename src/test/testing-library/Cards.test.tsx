import { render } from '@testing-library/react';
import { t } from 'i18next';

import Cards from '../../features/landing/components/ForWhoSection/Cards/Cards';

const cardTitle: string = t('for_who.card_text_title');
const cardText: string = t('for_who.heading_secondary');
const cardBusinessText: string = t('for_who.card_text_business');
const cardButton: string = t('for_who.button_text');
const forWhoImageAlt: string = t('for_who.vector_alt');

describe('Cards component', () => {
  it('renders secondary title correctly', () => {
    const { getByText, getAllByAltText } = render(<Cards />);

    expect(getAllByAltText(forWhoImageAlt)[0]).toBeInTheDocument();
    expect(getAllByAltText(forWhoImageAlt)[1]).toBeInTheDocument();
    expect(getByText(cardButton).closest('a')).toHaveAttribute('href', '#signUp');
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

  it('renders the cta without nested button semantics', () => {
    const { getByText, queryByRole } = render(<Cards />);

    expect(getByText(cardButton).closest('a')).toBeInTheDocument();
    expect(queryByRole('button', { name: cardButton })).not.toBeInTheDocument();
  });
});
