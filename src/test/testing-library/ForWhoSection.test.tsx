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

  it('should have a proper alt tag', () => {
    const { getAllByAltText } = render(<ForWhoSection />);
    const images: HTMLElement[] = getAllByAltText('Vector');

    expect(images).toHaveLength(5);
    expect(images[0]).toBeInTheDocument();
  });
});
