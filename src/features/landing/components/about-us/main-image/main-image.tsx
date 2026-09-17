import { Box } from '@mui/material';
import { StaticImageData } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import breakpointsTheme from '@/components/ui-breakpoints';

import { ProductScreenshots, productScreenshotsFor } from '../../../helpers/productScreenshots';

import styles from './styles';

type OptimizedImageProps = ReturnType<typeof getOptimizedImageProps>['props'];

const optimizedProps: (src: StaticImageData, alt: string) => OptimizedImageProps = (
  src: StaticImageData,
  alt: string
): OptimizedImageProps => getOptimizedImageProps({ src, alt }).props;

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
  const { t, i18n } = useTranslation();
  const screenshots: ProductScreenshots = productScreenshotsFor(i18n.language);
  const alt: string = t('about_vilna.image_alt');

  const mobileProps: OptimizedImageProps = optimizedProps(screenshots.mobile, alt);
  const tabletProps: OptimizedImageProps = optimizedProps(screenshots.tablet, alt);
  const desktopProps: OptimizedImageProps = optimizedProps(screenshots.desktop, alt);

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
          alt={desktopProps.alt}
        />
      </picture>
    </Box>
  );
}

export default MainImage;
