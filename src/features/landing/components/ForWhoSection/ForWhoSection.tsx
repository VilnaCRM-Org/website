import { Box, Container } from '@mui/material';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';

import bigScreen from '../../assets/img/about-vilna/desktop.jpg';
import smallScreen from '../../assets/img/about-vilna/mobile.jpg';
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
  const getImageProps: (src: string, alt: string) => React.ImgHTMLAttributes<HTMLImageElement> = (src, alt) => 
    getOptimizedImageProps({ src, alt }).props;

  return (
    <Box id="forWhoSection" component="section" sx={styles.wrapper}>
      <Container>
        <Box sx={styles.content}>
          <MainTitle />
          <Box sx={styles.lgCardsWrapper}>
            <Cards />
          </Box>
          <Box sx={styles.container}>
            <Box sx={styles.svgContainer}>
              <img 
              {...getImageProps(circle, 'circle')} 
              alt='Small circular element' 
              style={styles.circle}
              loading='lazy'
               />

              <img
              {...getImageProps(rhombus, 'rhombus')} 
              alt='Rhombus-shaped figure' 
              style={styles.rhombus}
              loading='lazy' 
              />
              <Box sx={styles.pointContainer}>
                <img
                 {...getImageProps(point6, 'point6')} 
                 alt='Decorative dot' 
                 style={styles.point6}
                 loading='lazy' 
                 />
                <img 
                {...getImageProps(point8, 'point8')} 
                alt='Decorative dot' 
                style={styles.point8}
                loading='lazy' 
                />
                <img 
                {...getImageProps(point10, 'point10')}
                alt='Decorative dot' 
                style={styles.point10} 
                loading='lazy'
                />
              </Box>
            </Box>
            <Box sx={styles.square}>
              <img 
              {...getImageProps(bigScreen, 'bigScreen')} 
              alt='Large digital screen with a blue background' 
              style={styles.bigScreen} 
              loading='lazy'
              />
              <img
              {...getImageProps(smallScreen, 'smallScreen')} 
              alt='Small digital screen displaying minimal content' 
              style={styles.smallScreen} 
              loading='lazy'
              />
              <img 
              {...getImageProps(waves, 'waves')} 
              alt='Abstract waves' 
              style={styles.waves}
              loading='lazy' 
              />
              <img 
              {...getImageProps(hexagon, 'hexagon')} 
              alt='Hexagon shape' 
              style={styles.hexagon}
              loading='lazy' 
              />
            </Box>
            <img 
            {...getImageProps(triangle, 'triangle')} 
            alt='Triangle shape' 
            style={styles.triangle} 
            loading='lazy'
            />
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
