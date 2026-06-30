import { render } from '@testing-library/react';
import { t } from 'i18next';

import Possibilities from '@landing/possibilities';
import { cardList, imageList } from '@landing/possibilities/constants';
import PossibilitiesComponent from '@landing/possibilities/possibilities';

jest.mock('../../../../src/components/ui-card-list/card-swiper', () => jest.fn(() => null));

describe('Possibilities integration', () => {
  it('renders the Integration section wrapper via the barrel export', () => {
    const { container } = render(<Possibilities />);

    const wrapper: HTMLElement | null = container.querySelector('#Integration');

    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.tagName.toLowerCase()).toBe('section');
  });

  it('renders the registration heading text inside the section', () => {
    const { getByText } = render(<PossibilitiesComponent />);

    expect(getByText(t('unlimited_possibilities.main_heading_text'))).toBeInTheDocument();
    expect(getByText(t('unlimited_possibilities.secondary_heading_text'))).toBeInTheDocument();
  });

  it('exposes the card and image constants used by the section', () => {
    expect(cardList).toHaveLength(4);
    expect(imageList).toHaveLength(8);
    cardList.forEach(card => {
      expect(card.type).toBe('smallCard');
      expect(card.imageSrc).toBeDefined();
    });
    imageList.forEach(image => {
      expect(image.alt).toBeTruthy();
      expect(image.image).toBeDefined();
    });
  });
});
