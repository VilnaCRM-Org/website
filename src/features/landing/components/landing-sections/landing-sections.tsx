import { Box, Container } from '@mui/material';
import React from 'react';

import AboutUs from '../about-us';
import AuthSection from '../auth-section';
import BackgroundImages from '../background-images';
import ForWhoSection from '../for-who-section';
import Possibilities from '../possibilities';
import WhyUs from '../why-us';

import styles from './styles';

function LandingSections(): React.ReactElement {
  return (
    <>
      <Box sx={styles.sections}>
        <BackgroundImages />
        <AboutUs />
        <Container maxWidth="xl">
          <WhyUs />
        </Container>
        <ForWhoSection />
        <Container maxWidth="xl">
          <Possibilities />
        </Container>
      </Box>
      <AuthSection />
    </>
  );
}

export default LandingSections;
