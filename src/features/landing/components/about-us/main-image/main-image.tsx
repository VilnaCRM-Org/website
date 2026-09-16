import { Box } from '@mui/material';
import { StaticImageData } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import breakpointsTheme from '@/components/ui-breakpoints';

import { ProductScreenshots, productScreenshotsFor } from '../../../helpers/productScreenshots';

import styles from './styles';

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
  const { t, i18n } = useTranslation();
  const screenshots: ProductScreenshots = productScreenshotsFor(i18n.language);

  const mobileProps: OptimizedImageProps = optimizedProps(screenshots.mobile);
  const tabletProps: OptimizedImageProps = optimizedProps(screenshots.tablet);
  const desktopProps: OptimizedImageProps = optimizedProps(screenshots.desktop);

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
