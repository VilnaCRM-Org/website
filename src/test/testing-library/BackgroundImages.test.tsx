import { render } from '@testing-library/react';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import '@testing-library/jest-dom';

import BackgroundImages from '../../features/landing/components/BackgroundImages/BackgroundImages';

jest.mock('../../features/landing/assets/svg/about-vilna/Vector.svg', () => 'test-image.jpg');

jest.mock('next-export-optimize-images/image', () => ({
  getOptimizedImageProps: jest.fn(({ src }) => ({
    props: {
      src,
      alt: 'Wave',
    },
  })),
}));

describe('BackgroundImages Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<BackgroundImages />);
    expect(container).toBeInTheDocument();
  });

  it('renders with correct styles', () => {
    const { container } = render(<BackgroundImages />);

    expect(container.firstChild).toHaveStyle({ backgroundImage: 'url(test-image.jpg)' });
  });

  it('calls getOptimizedImageProps with correct arguments', () => {
    render(<BackgroundImages />);
    expect(getOptimizedImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        src: expect.any(String),
        alt: 'Wave',
      })
    );
  });
});
