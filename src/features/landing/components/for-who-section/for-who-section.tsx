import { Box, Container, SxProps, Theme } from '@mui/material';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import bigScreen from '../../assets/img/about-vilna/desktop.jpg';
import smallScreen from '../../assets/img/about-vilna/mobile.jpg';
import circle from '../../assets/svg/for-who/circle.svg';
import hexagon from '../../assets/svg/for-who/hexagon.svg';
import point10 from '../../assets/svg/for-who/point10.svg';
import point6 from '../../assets/svg/for-who/point6.svg';
import point8 from '../../assets/svg/for-who/point8.svg';
import pointGroup from '../../assets/svg/for-who/pointGroup.svg';
import rhombus from '../../assets/svg/for-who/rhombus.svg';
import triangle from '../../assets/svg/for-who/triangle.svg';
import waves from '../../assets/svg/for-who/waves.svg';

import { Cards } from './cards';
import MainTitle from './main-title/main-title';
import styles from './styles';

type ImgAttrs = React.ImgHTMLAttributes<HTMLImageElement>;

const getImageProps: (src: string, alt?: string) => ImgAttrs = (src, alt = '') =>
  getOptimizedImageProps({ src, alt }).props;

// Decorative shape: empty alt + aria-hidden so assistive tech skips it.
function DecorativeImage({ src, sx }: { src: string; sx: SxProps<Theme> }): React.ReactElement {
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
  const { t } = useTranslation();

  const bigScreenProps: ImgAttrs = getImageProps(bigScreen, t('alts.big_screen'));
  const smallScreenProps: ImgAttrs = getImageProps(smallScreen, t('alts.small_screen'));

  return (
    <Box sx={styles.square}>
      <Box component="img" {...bigScreenProps} sx={styles.bigScreen} loading="lazy" />
      <Box component="img" {...smallScreenProps} sx={styles.smallScreen} loading="lazy" />
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
