import { useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { SIGNUP_MUTATION } from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import isHttpError from '../../../helpers/isHttpError';
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
      setErrorDetails('');
      setIsNotificationOpen(true);
      setNotificationType('success');
    } catch (error: unknown) {
      if (isHttpError(error)) {
        if (error.statusCode === 500) {
          setNotificationType('error');
          setIsNotificationOpen(true);
          setErrorDetails('');
        } else {
          setErrorDetails(error.message);
        }
      } else if (error instanceof Error) {
        setErrorDetails(error.message);
      } else {
        setErrorDetails('An unexpected error occurred');
      }
    }
  };
  const retrySubmit: () => void = (): void => {
    handleSubmit(onSubmit)();
  };

  useFormReset({ formState, reset, errorDetails, notificationType });

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
