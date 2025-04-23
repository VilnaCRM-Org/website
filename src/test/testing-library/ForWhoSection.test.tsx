import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ForWhoSection from '../../features/landing/components/ForWhoSection/ForWhoSection';

const forWhoLabel: string = t('for_who.aria_label');

describe('ForWhoSection component', () => {
  it('should render the ForWhoSection component without errors', () => {
    const { getAllByLabelText } = render(<ForWhoSection />);
    expect(getAllByLabelText(forWhoLabel)[0]).toBeInTheDocument();
  });

  it('should have correct number of decorative images with empty alt', () => {
    const { getAllByAltText } = render(<ForWhoSection />);
    
    const decorativeImages: HTMLElement[] = getAllByAltText('');
    expect(decorativeImages).toHaveLength(12);
  });

  it('should have main images with proper alt text', () => {
    const { getByAltText } = render(<ForWhoSection />);
    
    expect(getByAltText(t('alts.bigScreen'))).toBeInTheDocument();
    expect(getByAltText(t('alts.smallScreen'))).toBeInTheDocument();
  });

  it('should render Cards component twice (for desktop and mobile)', () => {
    const { getAllByTestId } = render(<ForWhoSection />);
    const cardsComponents: HTMLElement[] = getAllByTestId('cards-component');
    expect(cardsComponents).toHaveLength(2);
  });
});

