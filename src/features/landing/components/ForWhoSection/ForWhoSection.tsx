import { Box, Container } from '@mui/material';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

// SVG импортируются как URL (строки)
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

type ImgProps = ReturnType<typeof getOptimizedImageProps>['props'];

// Возвращаем props для изображения или undefined, если src нет
function getImageProps(src?: string, alt = ''): ImgProps | undefined {
  if (!src) return undefined;
  return getOptimizedImageProps({ src, alt }).props;
}

function ForWhoSection(): React.ReactElement {
  const { t } = useTranslation();

  const circleProps: ImgProps | undefined = getImageProps(circle);
  const rhombusProps: ImgProps | undefined = getImageProps(rhombus);
  const pointGroupProps: ImgProps | undefined = getImageProps(pointGroup);
  const point6Props: ImgProps | undefined = getImageProps(point6);
  const point8Props: ImgProps | undefined = getImageProps(point8);
  const point10Props: ImgProps | undefined = getImageProps(point10);
  const wavesProps: ImgProps | undefined = getImageProps(waves);
  const hexagonProps: ImgProps | undefined = getImageProps(hexagon);
  const triangleProps: ImgProps | undefined = getImageProps(triangle);

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
              {circleProps && (
                <Box
                  component="img"
                  {...circleProps}
                  aria-hidden="true"
                  sx={styles.circle}
                  loading="lazy"
                />
              )}
              {rhombusProps && (
                <Box
                  component="img"
                  {...rhombusProps}
                  aria-hidden="true"
                  sx={styles.rhombus}
                  loading="lazy"
                />
              )}
              <Box sx={styles.pointContainer}>
                {pointGroupProps && (
                  <Box
                    component="img"
                    {...pointGroupProps}
                    aria-hidden="true"
                    sx={styles.pointGroup}
                    loading="lazy"
                  />
                )}
                {point6Props && (
                  <Box
                    component="img"
                    {...point6Props}
                    aria-hidden="true"
                    sx={styles.point6}
                    loading="lazy"
                  />
                )}
                {point8Props && (
                  <Box
                    component="img"
                    {...point8Props}
                    aria-hidden="true"
                    sx={styles.point8}
                    loading="lazy"
                  />
                )}
                {point10Props && (
                  <Box
                    component="img"
                    {...point10Props}
                    aria-hidden="true"
                    sx={styles.point10}
                    loading="lazy"
                  />
                )}
              </Box>
            </Box>
            <Box sx={styles.square}>
              <Box sx={styles.bigScreen}>
                <img
                  src="/assets/img/about-vilna/desktop.jpg"
                  alt={t('alts.big_screen')}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto' }}
                />
              </Box>
              <Box sx={styles.smallScreen}>
                <img
                  src="/assets/img/about-vilna/mobile.jpg"
                  alt={t('alts.small_screen')}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto' }}
                />
              </Box>
              {wavesProps && (
                <Box
                  component="img"
                  {...wavesProps}
                  aria-hidden="true"
                  sx={styles.waves}
                  loading="lazy"
                />
              )}
              {hexagonProps && (
                <Box
                  component="img"
                  {...hexagonProps}
                  aria-hidden="true"
                  sx={styles.hexagon}
                  loading="lazy"
                />
              )}
              {triangleProps && (
                <Box
                  component="img"
                  {...triangleProps}
                  aria-hidden="true"
                  sx={styles.triangle}
                  loading="lazy"
                />
              )}
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
