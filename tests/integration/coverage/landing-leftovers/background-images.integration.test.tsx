/**
 * Integration coverage for the BackgroundImages feature subtree.
 *
 * Renders the REAL `BackgroundImages` component (and, via the barrel, its
 * `styles`) inside the integration jsdom-fetch environment with i18next
 * initialised by `jest.setup.ts`. The component pulls optimized image props
 * through `next-export-optimize-images/image`, so this exercises the whole
 * render path end-to-end rather than with the image layer stubbed.
 */
import { render } from '@testing-library/react';

import BackgroundImagesBarrel from '@components/BackgroundImages';
import BackgroundImages from '@components/BackgroundImages/BackgroundImages';
import styles from '@components/BackgroundImages/styles';

describe('BackgroundImages integration', () => {
  it('re-exports the component from its barrel', () => {
    expect(BackgroundImagesBarrel).toBe(BackgroundImages);
  });

  it('exposes the vector style object with the responsive breakpoints', () => {
    expect(styles.vector).toEqual(
      expect.objectContaining({
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        position: 'absolute',
      })
    );
  });

  it('renders a Box wired with the optimized background image url', () => {
    const { container } = render(<BackgroundImages />);

    const box: HTMLElement | null = container.querySelector('.MuiBox-root');

    expect(box).toBeInTheDocument();
    expect(box).toHaveStyle({ backgroundRepeat: 'no-repeat' });
    expect(box).toHaveStyle({ position: 'absolute' });

    const { backgroundImage } = window.getComputedStyle(box as HTMLElement);
    expect(backgroundImage).toMatch(/^url\(["']?\/_next\/static\/chunks\/images\/.+["']?\)$/);
  });
});
