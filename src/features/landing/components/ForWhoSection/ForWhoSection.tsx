import { Box, Container } from '@mui/material';
import Image from 'next/image';
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

import { Cards } from './Cards';
import MainTitle from './MainTitle/MainTitle';
import styles from './styles';

function ForWhoSection(): React.ReactElement {
  const { t } = useTranslation();

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
                src={circle}
                aria-hidden="true"
                sx={styles.circle}
                loading="lazy"
              />
              <Box
                component="img"
                src={rhombus}
                aria-hidden="true"
                sx={styles.rhombus}
                loading="lazy"
              />
              <Box sx={styles.pointContainer}>
                <Box
                  component="img"
                  src={pointGroup}
                  aria-hidden="true"
                  sx={styles.pointGroup}
                  loading="lazy"
                />
                <Box
                  component="img"
                  src={point6}
                  aria-hidden="true"
                  sx={styles.point6}
                  loading="lazy"
                />
                <Box
                  component="img"
                  src={point8}
                  aria-hidden="true"
                  sx={styles.point8}
                  loading="lazy"
                />
                <Box
                  component="img"
                  src={point10}
                  aria-hidden="true"
                  sx={styles.point10}
                  loading="lazy"
                />
              </Box>
            </Box>
            <Box sx={styles.square}>
              <Image
                src="/assets/img/about-vilna/desktop.jpg"
                alt={t('alts.big_screen')}
                width={1920}
                height={1080}
                style={styles.bigScreen}
              />
             <Image src="/img/about-vilna/mobile.jpg" alt="описание" width={600} height={400} />
              <Box
                component="img"
                src={hexagon}
                aria-hidden="true"
                sx={styles.hexagon}
                loading="lazy"
              />
              <Box
                component="img"
                src={triangle}
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
