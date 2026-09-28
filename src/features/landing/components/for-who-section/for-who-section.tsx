import { Box, Container, SxProps, Theme } from '@mui/material';
import { StaticImageData } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import circle from '../../assets/svg/for-who/circle.svg';
import hexagon from '../../assets/svg/for-who/hexagon.svg';
import point10 from '../../assets/svg/for-who/point10.svg';
import point6 from '../../assets/svg/for-who/point6.svg';
import point8 from '../../assets/svg/for-who/point8.svg';
import pointGroup from '../../assets/svg/for-who/pointGroup.svg';
import rhombus from '../../assets/svg/for-who/rhombus.svg';
import triangle from '../../assets/svg/for-who/triangle.svg';
import waves from '../../assets/svg/for-who/waves.svg';
import { ProductScreenshots, productScreenshotsFor } from '../../helpers/productScreenshots';

import { Cards } from './cards';
import MainTitle from './main-title/main-title';
import styles from './styles';

type ImgAttrs = React.ImgHTMLAttributes<HTMLImageElement>;

const getImageProps: (src: string | StaticImageData) => ImgAttrs = src =>
  getOptimizedImageProps({ src, alt: '' }).props;

function DecorativeImage({
  src,
  sx,
}: {
  src: string | StaticImageData;
  sx: SxProps<Theme>;
}): React.ReactElement {
  return <Box component="img" {...getImageProps(src)} aria-hidden="true" sx={sx} loading="lazy" />;
}

function ForWhoShapes(): React.ReactElement {
  return (
    <Box sx={styles.svgContainer}>
      <DecorativeImage src={circle} sx={styles.circle} />
      <DecorativeImage src={rhombus} sx={styles.rhombus} />
      <Box sx={styles.pointContainer}>
        <DecorativeImage src={pointGroup} sx={styles.pointGroup} />
        <DecorativeImage src={point6} sx={styles.point6} />
        <DecorativeImage src={point8} sx={styles.point8} />
        <DecorativeImage src={point10} sx={styles.point10} />
      </Box>
    </Box>
  );
}

function ForWhoScreens(): React.ReactElement {
  const { i18n } = useTranslation();
  const screenshots: ProductScreenshots = productScreenshotsFor(i18n.language);

  return (
    <Box sx={styles.square}>
      <DecorativeImage src={screenshots.desktop} sx={styles.bigScreen} />
      <DecorativeImage src={screenshots.mobile} sx={styles.smallScreen} />
      <DecorativeImage src={waves} sx={styles.waves} />
      <DecorativeImage src={hexagon} sx={styles.hexagon} />
      <DecorativeImage src={triangle} sx={styles.triangle} />
    </Box>
  );
}

function ForWhoVisuals(): React.ReactElement {
  return (
    <Box sx={styles.container}>
      <ForWhoShapes />
      <ForWhoScreens />
    </Box>
  );
}

function ForWhoSection(): React.ReactElement {
  return (
    <Box id="forWhoSection" component="section" sx={styles.wrapper}>
      <Container>
        <Box sx={styles.content}>
          <MainTitle />
          <Box sx={styles.lgCardsWrapper}>
            <Cards />
          </Box>
          <ForWhoVisuals />
        </Box>
      </Container>
      <Box sx={styles.smCardsWrapper}>
        <Cards />
      </Box>
      <Box sx={styles.line} />
    </Box>
  );
}

export default ForWhoSection;
