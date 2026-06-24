import { render } from '@testing-library/react';
import { t } from 'i18next';

import { ServicesHoverCard } from '@landing/possibilities/services-hover-card';
import HoverCardDefault from '@landing/possibilities/services-hover-card/services-hover-card';

describe('ServicesHoverCard integration', () => {
  it('renders the service title and text via the barrel export', () => {
    const { getByText } = render(<ServicesHoverCard />);

    expect(getByText(t('unlimited_possibilities.service_text.title'))).toBeInTheDocument();
    expect(getByText(t('unlimited_possibilities.service_text.text'))).toBeInTheDocument();
  });

  it('renders one image per configured integration via the default export', () => {
    const { getAllByAltText } = render(<HoverCardDefault />);

    const images: HTMLElement[] = getAllByAltText(/.+/);
    expect(images).toHaveLength(8);
  });
});
