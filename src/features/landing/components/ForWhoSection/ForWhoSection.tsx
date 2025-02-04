import { Box, Container } from '@mui/material';
import React from 'react';
import { ImageProps } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';

import smallScreen from '../../assets/img/about-vilna/mobile2Screen.png';
import bigScreen from '../../assets/img/about-vilna/mobileScreen.png';
import circle from '../../assets/svg/for-who/circle.svg';
import hexagon from '../../assets/svg/for-who/hexagon.svg';
import point10 from '../../assets/svg/for-who/point10.svg';
import point6 from '../../assets/svg/for-who/point6.svg';
import point8 from '../../assets/svg/for-who/point8.svg';
import rhombus from '../../assets/svg/for-who/romb.svg';
import triangle from '../../assets/svg/for-who/triangle.svg';
import waves from '../../assets/svg/for-who/waves.svg';

import { Cards } from './Cards';
import MainTitle from './MainTitle/MainTitle';
import styles from './styles';

function ForWhoSection(): React.ReactElement {
  const getImageProps = (src: string, alt: string) => getOptimizedImageProps({ src, alt }).props;

  return (
    <Box id="forWhoSection" component="section" sx={styles.wrapper}>
      <Container>
        <Box sx={styles.content}>
          <MainTitle />
          <Box sx={styles.lgCardsWrapper}>
            <Cards />
          </Box>
          <div style={styles.container}>
            <div style={styles.svg_container}>
              <img {...getImageProps(circle, 'circle')} style={styles.circle} />
              <img {...getImageProps(rhombus, 'rhombus')} style={styles.rhombus} />
              <div style={styles.point_container}>
                <img {...getImageProps(point6, 'point6')} style={styles.point6} />
                <img {...getImageProps(point8, 'point8')} style={styles.point8} />
                <img {...getImageProps(point10, 'point10')} style={styles.point10} />
              </div>
            </div>
            <div style={styles.square}>
              <img {...getImageProps(bigScreen, 'bigScreen')} style={styles.bigScreen} />
              <img {...getImageProps(smallScreen, 'smallScreen')} style={styles.smallScreen} />
              <img {...getImageProps(waves, 'waves')} style={styles.waves} />
              <img {...getImageProps(hexagon, 'hexagon')} style={styles.hexagon} />
            </div>
            <img {...getImageProps(triangle, 'triangle')} style={styles.triangle} />
          </div>
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
