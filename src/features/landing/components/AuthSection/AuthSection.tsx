import { Box, Container, Stack } from '@mui/material';
import React from 'react';

import { AuthForm } from './AuthForm';
import { socialLinks } from './constants';
import { SignUpText } from './SignUpText';
import styles from './styles';

function AuthSection(): React.ReactElement {
  return (
    <Box sx={styles.wrapper} component="section">
      <Container>
        <Stack justifyContent="space-between" sx={styles.content}>
          <SignUpText socialLinks={socialLinks} />
          <AuthForm />
        </Stack>
      </Container>
    </Box>
  );
}

export default AuthSection;
