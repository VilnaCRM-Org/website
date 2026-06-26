import { useMutation } from '@apollo/client/react';
import { Box, CircularProgress, Fade } from '@mui/material';
import React from 'react';
import { useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';

import { SignUpInput } from '../../../api/service/types';
import SIGNUP_MUTATION from '../../../api/service/userService';
import { animationTimeout } from '../../../constants';
import { handleApolloError } from '../../../helpers/handleApolloError';
import useFormReset from '../../../hooks/useFormReset';
import { RegisterItem } from '../../../types/authentication/form';
import Notification from '../../notification/notification';
import { NotificationStatus } from '../../notification/types';

import AuthForm from './auth-form';
import styles from './styles';
import { CreateUserPayload, SignupVariables } from './types';

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

type NotificationState = ReturnType<typeof useNotificationState>;
type SignupMutate = (options: { variables: SignupVariables }) => Promise<unknown>;

function buildSignupInput(userData: RegisterItem, clientID: string): SignUpInput {
  return {
    email: userData.Email.toLowerCase(),
    initials: userData.FullName,
    password: userData.Password,
    clientMutationId: clientID,
  };
}

function onSignupSuccess(notif: NotificationState): void {
  notif.setIsNotificationOpen(true);
  notif.setNotificationType(NotificationStatus.SUCCESS);
}

function onSignupError(notif: NotificationState, error: unknown): void {
  notif.setErrorText(handleApolloError({ error }));
  notif.setNotificationType(NotificationStatus.ERROR);
  notif.setIsNotificationOpen(true);
}

function buildSubmitHandler(
  signupMutation: SignupMutate,
  notif: NotificationState
): (userData: RegisterItem) => Promise<void> {
  return async (userData: RegisterItem): Promise<void> => {
    const clientID: string = uuidv4();
    try {
      await signupMutation({ variables: { input: buildSignupInput(userData, clientID) } });
      onSignupSuccess(notif);
    } catch (error) {
      onSignupError(notif, error);
    }
  };
}

function useSignupForm() {
  const notif = useNotificationState();
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
