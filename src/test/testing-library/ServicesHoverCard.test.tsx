import { render } from '@testing-library/react';
import React from 'react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import ServicesHoverCard from '../../features/landing/components/Possibilities/ServicesHoverCard/ServicesHoverCard';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const hoverCardTitle: string = t('unlimited_possibilities.service_text.title');
const hoverCardText: string = t('unlimited_possibilities.service_text.text');

describe('ServicesHoverCard component', () => {
  it('renders title and text correctly', () => {
    const { getByText } = render(<ServicesHoverCard />);

    expect(getByText(hoverCardTitle)).toBeInTheDocument();
    expect(getByText(hoverCardText)).toBeInTheDocument();
  });

  it('renders images correctly', () => {
    const { getAllByAltText } = render(<ServicesHoverCard />);

    const images: HTMLElement[] = getAllByAltText(/.+/);
    expect(images.length).toBe(8);
  });
});
