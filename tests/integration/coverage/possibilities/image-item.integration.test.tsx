import { render } from '@testing-library/react';

import { ImageItem } from '@landing/possibilities/services-hover-card/image-item';
import ImageItemDefault from '@landing/possibilities/services-hover-card/image-item/image-item';

import { ImageList } from '../../../../src/features/landing/types/possibilities/image-list';

const item: ImageList = {
  image: '/integration-image.png',
  alt: 'Integration image alt',
};

describe('ImageItem integration', () => {
  it('renders an image with the provided src and alt via the barrel export', () => {
    const { getByAltText } = render(<ImageItem item={item} />);

    const image: HTMLImageElement = getByAltText(item.alt) as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('alt', item.alt);
    expect(image).toHaveAttribute('src', expect.stringContaining('integration-image'));
  });

  it('renders the same image via the default export', () => {
    const { getByAltText } = render(<ImageItemDefault item={item} />);

    expect(getByAltText(item.alt)).toBeInTheDocument();
  });
});
