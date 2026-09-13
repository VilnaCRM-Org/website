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

import BackgroundImagesBarrel from '@landing/background-images';
import BackgroundImages from '@landing/background-images/background-images';
import styles from '@landing/background-images/styles';

describe('BackgroundImages integration', () => {
  it('re-exports the component from its barrel', () => {
    expect(BackgroundImagesBarrel).toBe(BackgroundImages);
  });

  it('builds the vector style from the image url without mutating a shared object', () => {
    // `vector` is a function of the image src (ADR 0005): the component used to
    // `Object.assign` the url onto the shared style object on every render.
    const first = styles.vector('/first.svg');
    const second = styles.vector('/second.svg');

    expect(first).toEqual(
      expect.objectContaining({
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        position: 'absolute',
        backgroundImage: 'url(/first.svg)',
      })
    );
    expect(second.backgroundImage).toBe('url(/second.svg)');
    expect(first.backgroundImage).toBe('url(/first.svg)');
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
