import { Container, Stack } from '@mui/material';
import React from 'react';

import { DeviceImage } from './device-image';
import styles from './styles';
import { TextInfo } from './text-info';

function AboutUs(): React.ReactElement {
  return (
    <Stack component="section" sx={[styles.wrapper, { alignItems: 'center' }]}>
      <Container maxWidth="xl" sx={styles.content}>
        <TextInfo />
        <DeviceImage />
      </Container>
    </Stack>
  );
}

export default AboutUs;
