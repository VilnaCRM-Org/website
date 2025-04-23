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

import { Cards } from './Cards';
import MainTitle from './MainTitle/MainTitle';
import styles from './styles';

const getImageProps: (src: string, alt?: string) => React.ImgHTMLAttributes<HTMLImageElement> = (
  src,
  alt = ''
) => getOptimizedImageProps({ src, alt }).props;

function ForWhoSection(): React.ReactElement {
  const { t } = useTranslation();

  const bigScreenProps: React.ImgHTMLAttributes<HTMLImageElement> = getOptimizedImageProps({
    src: bigScreen,
    alt: t('alts.bigScreen')
  }).props;

  const smallScreenProps: React.ImgHTMLAttributes<HTMLImageElement> = getOptimizedImageProps({
    src: smallScreen,
    alt: t('alts.smallScreen')
  }).props;

  type DecorativeImage = {
    src: string;
    sx: SxProps<Theme>;
  };

  const decorativeImages: DecorativeImage[] = [
    { src: circle, sx: styles.circle },
    { src: rhombus, sx: styles.rhombus },
    { src: pointGroup, sx: styles.pointGroup },
    { src: point6, sx: styles.point6 },
    { src: point8, sx: styles.point8 },
    { src: point10, sx: styles.point10 },
    { src: waves, sx: styles.waves },
    { src: hexagon, sx: styles.hexagon },
    { src: triangle, sx: styles.triangle }
  ];

  const svgGroup: DecorativeImage[] = decorativeImages.filter(({ src }) => 
    [circle, rhombus, pointGroup, point6, point8, point10].includes(src)
  );
  
  const squareGroup: DecorativeImage[] = decorativeImages.filter(({ src }) => 
    [waves, hexagon, triangle].includes(src)
  );

  return (
    <Box id="forWhoSection" component="section" sx={styles.wrapper}>
      <Container>
        <Box sx={styles.content}>
          <MainTitle />
          <Box sx={styles.lgCardsWrapper}>
            <Cards />
          </Box>
          <Box sx={styles.container}>
            <Box sx={styles.svg}>
              {svgGroup.map(({ src, sx }) => (
                <Box
                  key={`decorative-${src}`} 
                  component="img"
                  {...getImageProps(src)}
                  aria-hidden="true"
                  sx={sx}
                  loading="lazy"
                />
              ))}
            </Box>
            <Box sx={styles.square}>
              <Box component="img" {...bigScreenProps} sx={styles.bigScreen} loading="lazy" />
              <Box component="img" {...smallScreenProps} sx={styles.smallScreen} loading="lazy" />
              {squareGroup.map(({ src, sx }) => (
                <Box
                  key={`decorative-${src}`} 
                  component="img"
                  {...getImageProps(src)}
                  aria-hidden="true"
                  sx={sx}
                  loading="lazy"
                />
              ))}
            </Box>
          </Box>
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