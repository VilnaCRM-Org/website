import { Box, Container, Stack } from '@mui/material';
import React from 'react';

import AuthLayout from './AuthForm/AuthLayout';
import { socialLinks } from './constants';
import { SignUpText } from './SignUpText';
import styles from './styles';

function AuthSection(): React.ReactElement {
  return (
    <Box sx={styles.wrapper} component="section">
      <Container>
        <Stack sx={[styles.content, { justifyContent: 'space-between' }]}>
          <SignUpText socialLinks={socialLinks} />
          <AuthLayout />
        </Stack>
      </Container>
    </Box>
  );
}

export default AuthSection;
