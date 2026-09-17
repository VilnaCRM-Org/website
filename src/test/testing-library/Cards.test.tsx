import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import Cards from '../../features/landing/components/for-who-section/cards/cards';

const cardTitle: string = t('for_who.card_text_title');
const cardText: string = t('for_who.heading_secondary');
const cardBusinessText: string = t('for_who.card_text_business');
const cardButton: string = t('for_who.button_text');

describe('Cards component', () => {
  it('renders secondary title correctly', () => {
    const { getByText } = render(React.createElement(Cards));

    expect(getByText(cardButton).closest('a')).toHaveAttribute('href', '#signUp');
    expect(getByText(cardTitle)).toBeInTheDocument();
  });

  it('renders the bullet glyph of each card as decorative', () => {
    // The diamond used to be announced as "Vector, graphic" — the export tool's
    // artefact name — before every card (#479). It carries no information the
    // card text does not, so it is hidden from assistive technology entirely.
    const { container, queryAllByRole } = render(React.createElement(Cards));

    const bullets: NodeListOf<HTMLImageElement> = container.querySelectorAll('img');
    expect(bullets).toHaveLength(2);
    bullets.forEach(bullet => {
      expect(bullet).toHaveAttribute('alt', '');
      expect(bullet).toHaveAttribute('aria-hidden', 'true');
    });
    expect(queryAllByRole('img')).toHaveLength(0);
  });

  it('renders secondary text correctly', () => {
    const { getByText } = render(React.createElement(Cards));
    expect(getByText(cardText)).toBeInTheDocument();
  });

  it('renders card items correctly', () => {
    const { getByText } = render(React.createElement(Cards));
    expect(getByText(cardBusinessText)).toBeInTheDocument();
  });

  it('renders the cta without nested button semantics', () => {
    const { getByText, queryByRole } = render(React.createElement(Cards));

    expect(getByText(cardButton).closest('a')).toBeInTheDocument();
    expect(queryByRole('button', { name: cardButton })).not.toBeInTheDocument();
  });
});
