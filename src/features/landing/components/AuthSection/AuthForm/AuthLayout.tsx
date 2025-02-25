import { useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React, { useState } from 'react';

import { SIGNUP_MUTATION } from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../Notification/Notification';

import AuthForm from './AuthForm';
import styles from './styles';
import { CreateUserPayload, SignUpVariables } from './types';

function AuthLayout(): React.ReactElement {
  // const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [notificationType, setNotificationType] = useState<'error' | 'success'>('success');
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [serverError, setServerError] = React.useState('');
  const [signupMutation, { loading }] = useMutation<CreateUserPayload, SignUpVariables>(
    SIGNUP_MUTATION
  );

  const onSubmit: (data: RegisterItem) => Promise<void> = async (data: RegisterItem) => {
    try {
      await signupMutation({
        variables: {
          input: {
            email: data.Email,
            initials: data.FullName,
            password: data.Password,
            clientMutationId: '132',
          },
        },
      });

      // setIsAuthenticated(true);
      setServerError('');
      setNotificationOpen(true);
      setNotificationType('success');
    } catch (error) {
      if (error instanceof Error) {
        setServerError(error.message);
      } else {
        setServerError('An unexpected error occurred');
      }
      setNotificationType('error');
      setNotificationOpen(true);
    }
  };

  return (
    <Box sx={styles.formWrapper}>
      {loading && (
        <Box
          sx={styles.loader}
          role="status"
          component="div"
          aria-label="Loading"
          aria-live="polite"
        >
          <CircularProgress color="primary" size={70} />
        </Box>
      )}
      <Box sx={styles.backgroundImage} />
      <Box sx={styles.backgroundBlock} />

      <Fade in={!isNotificationOpen} timeout={animationTimeout}>
        <Box sx={styles.formContent}>
          <AuthForm serverError={serverError} onSubmit={onSubmit} />
        </Box>
      </Fade>

      <Notification
        type={notificationType}
        setIsOpen={setNotificationOpen}
        isOpen={isNotificationOpen}
      />
    </Box>
  );
}

export default AuthLayout;
