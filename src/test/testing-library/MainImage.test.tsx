import { render } from '@testing-library/react';

import MainImage from '../../features/landing/components/AboutUs/MainImage/MainImage';

const mainImageTestId: string = 'Main image';

describe('MainImage component', () => {
  it('renders the MainImage component with correct alt text', () => {
    const { container, getByAltText } = render(<MainImage />);

    const [smallMediaSource, largeMediaSource] = container.querySelectorAll('source');

    expect(getByAltText(mainImageTestId)).toBeInTheDocument();
    expect(smallMediaSource).toHaveAttribute('media', '(max-width: 640px)');
    expect(largeMediaSource).toHaveAttribute('media', '(max-width: 1024px)');
  });
});
