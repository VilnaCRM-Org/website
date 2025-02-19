import { useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React from 'react';

import { SIGNUP_MUTATION } from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import Notification from '../../Notification/Notification';

import AuthForm from './AuthForm';
import styles from './styles';
import { CreateUserPayload, SignUpVariables } from './types';

function AuthFormComponent(): React.ReactElement {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [signupMutation, { loading }] = useMutation<CreateUserPayload, SignUpVariables>(
    SIGNUP_MUTATION
  );

  return (
    <Box sx={styles.formWrapper}>
      {loading && (
        <Box sx={styles.loader} role="status" component='div' aria-label="Loading" aria-live="polite">
          <CircularProgress color="primary" size={70} />
        </Box>
      )}
      <Box sx={styles.backgroundImage} />
      <Box sx={styles.backgroundBlock} />

      <Fade in={!isAuthenticated} timeout={animationTimeout}>
        <Box sx={styles.formContent}>
          <AuthForm setIsAuthenticated={setIsAuthenticated} signupMutation={signupMutation} />
        </Box>
      </Fade>

      <Notification
        type="success"
        setIsOpen={setIsAuthenticated}
        isOpen={isAuthenticated}
      />
    </Box>
  );
}

export default AuthFormComponent;
