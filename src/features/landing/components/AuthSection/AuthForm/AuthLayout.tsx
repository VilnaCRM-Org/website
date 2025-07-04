import { useMutation } from '@apollo/client';
import { Box, CircularProgress, Fade } from '@mui/material';
import React from 'react';
import { useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';

import SIGNUP_MUTATION from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import { handleApolloError } from '../../../helpers/handleApolloError';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../Notification/Notification';
import { NotificationStatus } from '../../Notification/types';

import AuthForm from './AuthForm';
import styles from './styles';
import { CreateUserPayload, SignupVariables } from './types';

function AuthLayout(): React.ReactElement {
  const [notificationType, setNotificationType] = React.useState<NotificationStatus>(
    NotificationStatus.SUCCESS
  );
  const [isNotificationOpen, setIsNotificationOpen] = React.useState<boolean>(false);
  const [errorText, setErrorText] = React.useState('');
  const {
    handleSubmit,
    control,
    reset,
    formState,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: { FullName: '', Password: '', Email: '', Privacy: false },
  });
  const [signupMutation, { loading }] = useMutation<CreateUserPayload, SignupVariables>(
    SIGNUP_MUTATION
  );

  const handleSuccess: () => void = (): void => {
    setIsNotificationOpen(true);
    setNotificationType(NotificationStatus.SUCCESS);
  };
  const onSubmit: (userData: RegisterItem) => Promise<void> = async (userData: RegisterItem) => {
    const clientID: string = uuidv4();
    try {
      await signupMutation({
        variables: {
          input: {
            email: userData.Email.toLowerCase(),
            initials: userData.FullName,
            password: userData.Password,
            clientMutationId: clientID,
          },
        },
      });
      handleSuccess();
    } catch (error) {
      setErrorText(handleApolloError({ error }));
      setNotificationType(NotificationStatus.ERROR);
      setIsNotificationOpen(true);
    }
  };

  useFormReset({ formState, reset, notificationType });

  const retrySubmit: () => void = (): void => {
    handleSubmit(onSubmit)();
  };

  return (
    <Box sx={styles.formWrapper}>
      {loading && (
        <Box component="output" style={styles.loader} aria-label="Loading" aria-live="polite">
          <CircularProgress color="primary" size={70} />
        </Box>
      )}
      <Box sx={styles.backgroundImage} />
      <Box sx={styles.backgroundBlock} />

      <Fade in={!isNotificationOpen} timeout={animationTimeout}>
        <Box sx={styles.formContent}>
          <AuthForm
            onSubmit={onSubmit}
            formValidationErrors={errors}
            handleSubmit={handleSubmit}
            control={control}
            loading={loading}
          />
        </Box>
      </Fade>

      <Notification
        errorText={errorText}
        type={notificationType}
        setIsOpen={setIsNotificationOpen}
        isOpen={isNotificationOpen}
        onRetry={retrySubmit}
        loading={loading}
      />
    </Box>
  );
}

export default AuthLayout;
