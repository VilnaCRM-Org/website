import { Box } from '@mui/material';
import { ImageProps } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import breakpointsTheme from '@/components/UiBreakpoints';


import styles from './styles';

function MainImage(): React.ReactElement {
  const { t } = useTranslation();
const MainImageSrc: string = '/img/about-vilna/desktop.jpg';
const PhoneMainImage: string = '/img/about-vilna/mobile.jpg';

  const imgAltText: string = 'Main image';

  const mobileProps: ImageProps = getOptimizedImageProps({
    src: PhoneMainImage,
    alt: imgAltText,
    width: 100,
    height: 100,
  }).props;
  const tabletProps: ImageProps = getOptimizedImageProps({
  src: '/img/about-vilna/tablet.jpg',
  alt: imgAltText,
  width: 400,
  height: 300,
  }).props;
  const desktopProps: ImageProps = getOptimizedImageProps({
    src: MainImageSrc,
    alt: imgAltText,
  }).props;

  return (
    <Box sx={styles.mainImageWrapper}>
      <picture>
        <source
          srcSet={mobileProps.src as string}
          width={mobileProps.width}
          height={mobileProps.height}
          media={`(max-width: ${breakpointsTheme.breakpoints.values.sm}px)`}
        />
        <source
          srcSet={tabletProps.src as string}
          width={tabletProps.width}
          height={tabletProps.height}
          media={`(max-width: ${breakpointsTheme.breakpoints.values.lg}px)`}
        />
        <img
          src={desktopProps.src as string}
          width={desktopProps.width}
          height={desktopProps.height}
          alt={t(`${desktopProps.alt}`)}
        />
      </picture>
    </Box>
  );
}

export default MainImage;
