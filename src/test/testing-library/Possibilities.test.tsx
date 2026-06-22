import { render } from '@testing-library/react';

import Possibilities from '../../features/landing/components/possibilities';

jest.mock('../../components/ui-card-list/card-swiper', () => jest.fn());

describe('Header component', () => {
  it('renders logo', () => {
    const { container } = render(<Possibilities />);

    const possibilitiesWrapper: HTMLElement | null = container.querySelector('#Integration');

    expect(possibilitiesWrapper).toBeInTheDocument();
  });
});
