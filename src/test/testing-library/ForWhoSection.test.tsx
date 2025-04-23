import { render, within } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ForWhoSection from '../../features/landing/components/ForWhoSection/ForWhoSection';

const forWhoLabel: string = t('for_who.aria_label');

describe('ForWhoSection component', () => {
  it('should render without errors', () => {
    const { container } = render(<ForWhoSection />);
    expect(container).toBeInTheDocument();
  });

  it('should render all decorative images', () => {
    const { getAllByAltText } = render(<ForWhoSection />);
    const decorativeImages = getAllByAltText('');
    expect(decorativeImages.length).toBeGreaterThanOrEqual(9);
  });

  it('should render main images with proper alt text', () => {
    const { getByAltText } = render(<ForWhoSection />);
    expect(getByAltText(t('alts.bigScreen'))).toBeInTheDocument();
    expect(getByAltText(t('alts.smallScreen'))).toBeInTheDocument();
  });
});