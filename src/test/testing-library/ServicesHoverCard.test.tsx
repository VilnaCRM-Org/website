import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ServicesHoverCard from '../../features/landing/components/Possibilities/ServicesHoverCard/ServicesHoverCard';

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
    expect(images.length).toBe(6);
  });
});
