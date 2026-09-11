import { Box, Container } from '@mui/material';
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

import styles from './styles';

const DynamicBackgroundImages: ComponentType = dynamic(() => import('../background-images'), {
  ssr: false,
});
const DynamicAboutUs: ComponentType = dynamic(() => import('../about-us'), { ssr: false });

const DynamicForWhoSection: ComponentType = dynamic(() => import('../for-who-section'), {
  ssr: false,
});
const DynamicPossibilities: ComponentType = dynamic(() => import('../possibilities'), {
  ssr: false,
});
const DynamicWhyUs: ComponentType = dynamic(() => import('../why-us'), { ssr: false });
const DynamicAuthSection: ComponentType = dynamic(() => import('../auth-section'), { ssr: false });

function Landing(): React.ReactElement {
  return (
    <>
      <Box sx={styles.sections}>
        <DynamicBackgroundImages />
        <DynamicAboutUs />
        <Container maxWidth="xl">
          <DynamicWhyUs />
        </Container>
        <DynamicForWhoSection />
        <Container maxWidth="xl">
          <DynamicPossibilities />
        </Container>
      </Box>
      <DynamicAuthSection />
    </>
  );
}

export default Landing;
