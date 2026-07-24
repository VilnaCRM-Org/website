import { Box } from '@mui/material';
import { StaticImageData } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import breakpointsTheme from '@/components/ui-breakpoints';

import MainImageSrc from '../../../assets/img/about-vilna/desktop.jpg';
import PhoneMainImage from '../../../assets/img/about-vilna/mobile.jpg';
import TabletMainImage from '../../../assets/img/about-vilna/tablet.jpg';

import styles from './styles';

// The concrete props `next-export-optimize-images` emits differ from
// `next/image`'s `ImageProps` under `exactOptionalPropertyTypes`, so key off the
// optimizer's own return type instead of the stricter next/image one.
type OptimizedImageProps = ReturnType<typeof getOptimizedImageProps>['props'];

const IMG_ALT_TEXT: string = 'Main image';

const optimizedProps: (src: StaticImageData) => OptimizedImageProps = (
  src: StaticImageData
): OptimizedImageProps => getOptimizedImageProps({ src, alt: IMG_ALT_TEXT }).props;

function PictureSource({
  imageProps,
  media,
}: {
  imageProps: OptimizedImageProps;
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

  const mobileProps: OptimizedImageProps = optimizedProps(PhoneMainImage);
  const tabletProps: OptimizedImageProps = optimizedProps(TabletMainImage);
  const desktopProps: OptimizedImageProps = optimizedProps(MainImageSrc);

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
