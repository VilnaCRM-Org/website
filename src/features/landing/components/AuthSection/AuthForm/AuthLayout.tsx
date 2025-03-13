import { ApolloError, useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../Notification/Notification';
import { NotificationType } from '../../Notification/types';

import AuthForm from './AuthForm';
import styles from './styles';
import { CreateUserPayload, SignUpVariables } from './types';

function AuthLayout(): React.ReactElement {
  const [notificationType, setNotificationType] = useState<NotificationType>('success');
  const [errorDetails, setErrorDetails] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const {
    handleSubmit,
    control,
    reset,
    formState,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { Email: '', FullName: '', Password: '', Privacy: false },
  });
  const [signupMutation, { loading }] = useMutation<CreateUserPayload, SignUpVariables>(
    SIGNUP_MUTATION
  );

  const onSubmit: (userData: RegisterItem) => Promise<void> = async (userData: RegisterItem) => {
    try {
      await signupMutation({
        variables: {
          input: {
            email: userData.Email,
            initials: userData.FullName,
            password: userData.Password,
            clientMutationId: '132',
          },
        },
      });
      setErrorDetails('');
      setIsNotificationOpen(true);
      setNotificationType('success');
    } catch (error) {
      let message: string = 'An unexpected error occurred';

      if (error instanceof ApolloError || error instanceof Error) {
        message = error.message || message;
      }

      const normalizedMessage: string = message.toLowerCase().trim();
      const isServerError: boolean =
        normalizedMessage.includes('500') ||
        normalizedMessage.includes('server error') ||
        normalizedMessage.includes('internal server');

      if (isServerError) {
        setNotificationType('error');
        setIsNotificationOpen(true);
      } else {
        setErrorDetails(message);
      }
    }
  };

  useFormReset({ formState, reset, errorDetails, notificationType });

  const retrySubmit: () => void = (): void => {
    handleSubmit(onSubmit)();
  };

  return (
    <Box sx={styles.formWrapper}>
      {loading && (
        <Box
          sx={styles.loader}
          role="status"
          component="output"
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
          <AuthForm
            errorDetails={errorDetails}
            onSubmit={onSubmit}
            errors={errors}
            handleSubmit={handleSubmit}
            control={control}
          />
        </Box>
      </Fade>

      <Notification
        type={notificationType}
        setIsOpen={setIsNotificationOpen}
        isOpen={isNotificationOpen}
        retrySubmit={retrySubmit}
      />
    </Box>
  );
}

export default AuthLayout;
