import { StaticImageData } from 'next/image';

import { EN_LOCALE } from '@/config/locales';

import desktopEn from '../assets/img/about-vilna/desktop-en.jpg';
import desktopUk from '../assets/img/about-vilna/desktop-uk.jpg';
import mobileEn from '../assets/img/about-vilna/mobile-en.jpg';
import mobileUk from '../assets/img/about-vilna/mobile-uk.jpg';
import tabletEn from '../assets/img/about-vilna/tablet-en.jpg';
import tabletUk from '../assets/img/about-vilna/tablet-uk.jpg';

export interface ProductScreenshots {
  readonly desktop: StaticImageData;
  readonly tablet: StaticImageData;
  readonly mobile: StaticImageData;
}

export const UK_SCREENSHOTS: ProductScreenshots = Object.freeze({
  desktop: desktopUk,
  tablet: tabletUk,
  mobile: mobileUk,
});

export const EN_SCREENSHOTS: ProductScreenshots = Object.freeze({
  desktop: desktopEn,
  tablet: tabletEn,
  mobile: mobileEn,
});

const ENGLISH_TAG: RegExp = new RegExp(`^${EN_LOCALE}(?:-|$)`);

export function productScreenshotsFor(language: string): ProductScreenshots {
  return ENGLISH_TAG.test(language) ? EN_SCREENSHOTS : UK_SCREENSHOTS;
}
