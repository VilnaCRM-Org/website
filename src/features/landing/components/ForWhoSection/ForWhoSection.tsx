import { Box, Container } from '@mui/material';
import React from 'react';

import { Cards } from './Cards';
import MainTitle from './MainTitle/MainTitle';
import styles from './styles';
import bigScreen from '../../assets/img/about-vilna/mobileScreen.png';
import smallScreen from '../../assets/img/about-vilna/mobile2Screen.png';
import waves from '../../assets/svg/for-who/waves.svg';
import point6 from '../../assets/svg/for-who/point6.svg';
import point8 from '../../assets/svg/for-who/point8.svg';
import point10 from '../../assets/svg/for-who/point10.svg';
import circle from '../../assets/svg/for-who/circle.svg';
import romb from '../../assets/svg/for-who/romb.svg';
import hexagon from '../../assets/svg/for-who/hexagon.svg';
import triangle from '../../assets/svg/for-who/triangle.svg';

function ForWhoSection(): React.ReactElement {

  return (
    <Box id="forWhoSection" component="section" sx={styles.wrapper}>
      <Container>
        <Box sx={styles.content}>
          <MainTitle />
          <Box sx={styles.lgCardsWrapper}>
            <Cards />
          </Box>
          <div className='container'>
            <div className='svg-container'>
            <img src={circle} alt="circle" className="circle" />
            <img src={romb} alt="romb" className="romb" />
              <div className="point-container">
            <img src={point6} alt="point6" className="point6" />
            <img src={point8} alt="point8" className="point8" />
            <img src={point10} alt="point10" className="point10" />
              </div>
            </div>
           <div className='square'>
            <img src={bigScreen} alt="bigScreen" className="bigScreen" />
            <img src={smallScreen} alt="smallScreen" className="smallScreen" />
            <img src={waves} alt="waves" className="waves" />
            <img src={hexagon} alt="hexagon" className="hexagon" />
           </div>
           <img src={triangle} alt="triangle" className="triangle" />
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
