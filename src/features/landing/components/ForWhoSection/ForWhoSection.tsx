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
import pointGroup from '../../assets/svg/for-who/pointGroup.svg';
import rhombus from '../../assets/svg/for-who/rhombus.svg';
import triangle from '../../assets/svg/for-who/triangle.svg';
import waves from '../../assets/svg/for-who/waves.svg';

import { Cards } from './Cards';
import MainTitle from './MainTitle/MainTitle';
import styles from './styles';

function ForWhoSection(): React.ReactElement {
  const getImageProps: (src: string, alt?: string) => React.ImgHTMLAttributes<HTMLImageElement> = (
    src,
    alt = ''
  ) => getOptimizedImageProps({ src, alt }).props;

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
              <Box
                component="img"
                {...getImageProps(circle)}
                aria-hidden="true"
                sx={styles.circle}
                loading="lazy"
              />

              <Box
                component="img"
                {...getImageProps(rhombus)}
                aria-hidden="true"
                sx={styles.rhombus}
                loading="lazy"
              />
              <Box sx={styles.pointContainer}>
                <Box
                  component="img"
                  {...getImageProps(pointGroup)}
                  aria-hidden="true"
                  sx={styles.pointGroup}
                  loading="lazy"
                />
                <Box
                  component="img"
                  {...getImageProps(point6)}
                  aria-hidden="true"
                  sx={styles.point6}
                  loading="lazy"
                />
                <Box
                  component="img"
                  {...getImageProps(point8)}
                  aria-hidden="true"
                  sx={styles.point8}
                  loading="lazy"
                />
                <Box
                  component="img"
                  {...getImageProps(point10)}
                  aria-hidden="true"
                  sx={styles.point10}
                  loading="lazy"
                />
              </Box>
            </Box>
            <Box sx={styles.square}>
              <Box
                component="img"
                {...getImageProps(bigScreen, 'Large digital screen with a blue background')}
                sx={styles.bigScreen}
                loading="lazy"
              />
              <Box
                component="img"
                {...getImageProps(smallScreen, 'Small digital screen displaying minimal content')}
                sx={styles.smallScreen}
                loading="lazy"
              />
              <Box
                component="img"
                {...getImageProps(waves)}
                aria-hidden="true"
                sx={styles.waves}
                loading="lazy"
              />
              <Box
                component="img"
                {...getImageProps(hexagon)}
                aria-hidden="true"
                sx={styles.hexagon}
                loading="lazy"
              />
              <Box
                component="img"
                {...getImageProps(triangle)}
                aria-hidden="true"
                sx={styles.triangle}
                loading="lazy"
              />
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
