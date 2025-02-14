import { Box, Container, Stack } from '@mui/material';
import React from 'react';

import Notification from '../Notification';

import { AuthForm } from './AuthForm';
import { socialLinks } from './constants';
import { SignUpText } from './SignUpText';
import styles from './styles';

function AuthSection(): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  return (
    <Box sx={styles.wrapper} component="section">
      <Container>
        <Stack justifyContent="space-between" sx={styles.content}>
          <SignUpText socialLinks={socialLinks} />
          <Box sx={styles.formContainer}>
            <Notification
              type="success"
              setIsAuthenticated={setIsAuthenticated}
              isAuthenticated={isAuthenticated}
            />
            <AuthForm setIsAuthenticated={setIsAuthenticated} isAuthenticated={isAuthenticated} />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

export default AuthSection;
