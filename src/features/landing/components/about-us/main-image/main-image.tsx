import { Box } from '@mui/material';
import { ImageProps, StaticImageData } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import breakpointsTheme from '@/components/ui-breakpoints';

import MainImageSrc from '../../../assets/img/about-vilna/desktop.jpg';
import PhoneMainImage from '../../../assets/img/about-vilna/mobile.jpg';
import TabletMainImage from '../../../assets/img/about-vilna/tablet.jpg';

import styles from './styles';

const IMG_ALT_TEXT: string = 'Main image';

const optimizedProps: (src: StaticImageData) => ImageProps = (src: StaticImageData): ImageProps =>
  getOptimizedImageProps({ src, alt: IMG_ALT_TEXT }).props;

function PictureSource({
  imageProps,
  media,
}: {
  imageProps: ImageProps;
  media: string;
}): React.ReactElement {
  return (
    <source
      srcSet={imageProps.src as string}
      width={imageProps.width}
      height={imageProps.height}
      media={media}
    />
  );
}

function MainImage(): React.ReactElement {
  const { t } = useTranslation();

  const mobileProps: ImageProps = optimizedProps(PhoneMainImage);
  const tabletProps: ImageProps = optimizedProps(TabletMainImage);
  const desktopProps: ImageProps = optimizedProps(MainImageSrc);

  return (
    <Box sx={styles.mainImageWrapper}>
      <picture>
        <PictureSource
          imageProps={mobileProps}
          media={`(max-width: ${breakpointsTheme.breakpoints.values.sm}px)`}
        />
        <PictureSource
          imageProps={tabletProps}
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
