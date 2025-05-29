import { Box, Container } from '@mui/material';
import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

const DynamicBackgroundImages: ComponentType = dynamic(() => import('../BackgroundImages'), {
  ssr: false,
});
const DynamicAboutUs: ComponentType = dynamic(() => import('../AboutUs'), { ssr: false });

const DynamicForWhoSection: ComponentType = dynamic(() => import('../ForWhoSection'), {
  ssr: false,
});
const DynamicPossibilities: ComponentType = dynamic(() => import('../Possibilities'), {
  ssr: false,
});
const DynamicWhyUs: ComponentType = dynamic(() => import('../WhyUs'), { ssr: false });
const DynamicAuthSection: ComponentType = dynamic(() => import('../AuthSection'), { ssr: false });

function Landing(): React.ReactElement {
  return (
    <>
      <Box sx={{ position: 'relative' }}>
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
