import { useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import { handleApolloError } from '../../../helpers/handleApolloError';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../Notification/Notification';
import { NotificationType } from '../../Notification/types';

import AuthForm from './AuthForm';
import styles from './styles';
import {CreateUserPayload, NotificationStatus, SignUpVariables} from './types';


function AuthLayout(): React.ReactElement {
  const [notificationType, setNotificationType] = React.useState<NotificationType>(NotificationStatus.SUCCESS);
  const [errorDetails, setErrorDetails] = React.useState('');
  const [isNotificationOpen, setIsNotificationOpen] = React.useState<boolean>(false);
  const {
    handleSubmit,
    control,
    reset,
    formState,
    formState: { errors },
  } = useForm<RegisterItem>({ mode: 'onTouched' });
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
      setNotificationType(NotificationStatus.SUCCESS);
    } catch (err) {
      handleApolloError({ err, setErrorDetails, setNotificationType, setIsNotificationOpen });
    }
  };

  useFormReset({ formState, reset, errorDetails, notificationType });

  const retrySubmit: () => void = (): void => {
    handleSubmit(onSubmit)();
  };

  return (
    <Box sx={styles.formWrapper}>
      {loading && (
        <output style={styles.loader} aria-label="Loading" aria-live="polite">
          <CircularProgress color="primary" size={70} />
        </output>
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
