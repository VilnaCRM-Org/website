/**
 * Integration coverage for the AboutUs feature subtree.
 *
 * Renders the REAL `AboutUs` section (and, via the barrels, its `TextInfo`,
 * `DeviceImage`, `MainImage` and `Notch` children) inside the integration
 * jsdom-fetch environment with i18next initialised by `jest.setup.ts`. The
 * `MainImage` child pulls optimized image props through
 * `next-export-optimize-images/image`, so this exercises the whole render path
 * end-to-end rather than with the image layer stubbed.
 */
import { render } from '@testing-library/react';
import { t } from 'i18next';

import AboutUsBarrel from '@landing-components/AboutUs';
import AboutUs from '@landing-components/AboutUs/AboutUs';
import { DeviceImage } from '@landing-components/AboutUs/DeviceImage';
import DeviceImageDefault from '@landing-components/AboutUs/DeviceImage/DeviceImage';
import { MainImage } from '@landing-components/AboutUs/MainImage';
import MainImageDefault from '@landing-components/AboutUs/MainImage/MainImage';
import { Notch } from '@landing-components/AboutUs/Notch';
import NotchDefault from '@landing-components/AboutUs/Notch/Notch';
import { TextInfo } from '@landing-components/AboutUs/TextInfo';
import TextInfoDefault from '@landing-components/AboutUs/TextInfo/TextInfo';

const mainImageAlt: string = 'Main image';
const aboutText: string = t('about_vilna.text_main');
const aboutButton: string = t('about_vilna.button_main');

describe('AboutUs integration', () => {
  it('re-exports each child component from its barrel', () => {
    expect(AboutUsBarrel).toBe(AboutUs);
    expect(DeviceImage).toBe(DeviceImageDefault);
    expect(MainImage).toBe(MainImageDefault);
    expect(Notch).toBe(NotchDefault);
    expect(TextInfo).toBe(TextInfoDefault);
  });

  it('renders the section wrapper with heading and body copy', () => {
    const { container, getByRole, getByText } = render(<AboutUs />);

    expect(container.querySelector('section')).toBeInTheDocument();
    expect(getByRole('heading')).toBeInTheDocument();
    expect(getByText(aboutText)).toBeInTheDocument();
  });

  it('renders the CTA as a link to the sign up anchor without button semantics', () => {
    const { getByRole, queryByRole } = render(<AboutUs />);

    const ctaLink: HTMLElement = getByRole('link', { name: aboutButton });

    expect(ctaLink).toHaveAttribute('href', '#signUp');
    expect(queryByRole('button', { name: aboutButton })).not.toBeInTheDocument();
  });

  it('renders the device main image with responsive sources', () => {
    const { container, getByAltText } = render(<AboutUs />);

    expect(getByAltText(mainImageAlt)).toBeInTheDocument();

    const [mobileSource, tabletSource] = container.querySelectorAll('source');

    expect(mobileSource).toHaveAttribute('media', '(max-width: 640px)');
    expect(tabletSource).toHaveAttribute('media', '(max-width: 1024px)');
  });

  it('renders the Notch child standalone', () => {
    const { container } = render(<Notch />);

    expect(container.querySelector('.MuiBox-root')).toBeInTheDocument();
  });
});
