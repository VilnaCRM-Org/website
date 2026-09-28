import { useMutation } from '@apollo/client/react';
import { Box, CircularProgress, Fade } from '@mui/material';
import React from 'react';
import { useForm } from 'react-hook-form';

import SIGNUP_MUTATION from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../notification/notification';
import { NotificationStatus } from '../../notification/types';

import AuthForm from './auth-form';
import { createInFlightLock, lockSubmission } from './in-flight-lock';
import styles from './styles';
import { buildSubmitHandler } from './submit-handler';
import { AuthFormProps, CreateUserPayload, SignupVariables } from './types';

type SignupHandleSubmit = AuthFormProps['handleSubmit'];

function FormLoader(): React.ReactElement {
  return (
    <Box component="output" style={styles.loader} aria-label="Loading" aria-live="polite">
      <CircularProgress color="primary" size={70} />
    </Box>
  );
}

function useNotificationState() {
  const [notificationType, setNotificationType] = React.useState<NotificationStatus>(
    NotificationStatus.SUCCESS
  );
  const [isNotificationOpen, setIsNotificationOpen] = React.useState<boolean>(false);
  const [errorText, setErrorText] = React.useState('');

  return {
    notificationType,
    setNotificationType,
    isNotificationOpen,
    setIsNotificationOpen,
    errorText,
    setErrorText,
  };
}

function useInFlightHandleSubmit(handleSubmit: SignupHandleSubmit): SignupHandleSubmit {
  const [inFlight] = React.useState(createInFlightLock);

  return (onValid, onInvalid) => lockSubmission(inFlight, handleSubmit(onValid, onInvalid));
}

function useSignupForm() {
  const notif = useNotificationState();
  const {
    handleSubmit: submitUnlocked,
    control,
    reset,
    formState,
    formState: { errors },
  } = useForm<RegisterItem>({
    mode: 'onTouched',
    defaultValues: {
      FullName: '',
      Password: '',
      ConfirmPassword: '',
      Email: '',
      Privacy: false,
      Referral: '',
    },
  });
  const [signupMutation, { loading }] = useMutation<CreateUserPayload, SignupVariables>(
    SIGNUP_MUTATION
  );

  const handleSubmit = useInFlightHandleSubmit(submitUnlocked);
  const onSubmit = buildSubmitHandler(signupMutation, notif);
  useFormReset({ formState, reset, notificationType: notif.notificationType });
  const retrySubmit: () => void = (): void => {
    handleSubmit(onSubmit)();
  };

  return { notif, control, errors, handleSubmit, onSubmit, retrySubmit, loading };
}

function AuthLayout(): React.ReactElement {
  const { notif, control, errors, handleSubmit, onSubmit, retrySubmit, loading } = useSignupForm();

  return (
    <Box sx={styles.formWrapper}>
      {loading && <FormLoader />}
      <Box sx={styles.backgroundImage} />
      <Box sx={styles.backgroundBlock} />

      <Fade in={!notif.isNotificationOpen} timeout={animationTimeout}>
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
        errorText={notif.errorText}
        type={notif.notificationType}
        setIsOpen={notif.setIsNotificationOpen}
        isOpen={notif.isNotificationOpen}
        onRetry={retrySubmit}
        loading={loading}
      />
    </Box>
  );
}

export default AuthLayout;
