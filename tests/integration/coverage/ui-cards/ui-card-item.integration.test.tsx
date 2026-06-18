/**
 * Integration coverage for the UiCardItem module.
 *
 * Renders the REAL `UiCardItem` and `CardContent` (no component mocks) so the
 * whole vertical slice — Stack wrapper, UiImage, UiTypography, the i18n `Trans`
 * children and the ServicesHoverCard tooltip — is exercised in the jsdom-fetch
 * integration environment. Both `smallCard`/`largeCard` paths and both the
 * `text_integrate` and non-`text_integrate` branches of `CardContent` are
 * covered to drive the module to 100%.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import UiCardItem from '@/components/UiCardItem';
import CardContent from '@/components/UiCardItem/CardContent';
import { LARGE_CARD_ITEM, SMALL_CARD_ITEM } from '@/components/UiCardItem/constants';
import { CardItem } from '@/components/UiCardItem/types';

const integrateCardItem: CardItem = {
  ...SMALL_CARD_ITEM,
  id: 'integrate-card',
  text: 'unlimited_possibilities.cards_texts.text_integrate',
};

describe('integration: UiCardItem', () => {
  it('renders the large card variant with image and heading', () => {
    render(<UiCardItem item={LARGE_CARD_ITEM} />);

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', t(LARGE_CARD_ITEM.alt));

    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('renders the small card variant with image and heading', () => {
    render(<UiCardItem item={SMALL_CARD_ITEM} />);

    expect(screen.getByRole('img')).toHaveAttribute('alt', t(SMALL_CARD_ITEM.alt));
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  describe('CardContent', () => {
    it('renders the large variant without the services tooltip', () => {
      render(<CardContent item={LARGE_CARD_ITEM} isSmallCard={false} />);

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(document.getElementById('services-label')).toBeNull();
    });

    it('renders the small variant without the services-label id when text is not text_integrate', () => {
      render(<CardContent item={SMALL_CARD_ITEM} isSmallCard />);

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(document.getElementById('services-label')).toBeNull();
    });

    it('adds the services-label id when the text key contains text_integrate', () => {
      render(<CardContent item={integrateCardItem} isSmallCard />);

      expect(document.getElementById('services-label')).toBeInTheDocument();
    });
  });
});
