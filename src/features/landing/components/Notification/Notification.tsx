import { Box, Fade } from '@mui/material';
import React from 'react';

import { animationTimeout } from '../../constants';

import NotificationError from './NotificationError';
import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import {
  NotificationComponentMap,
  NotificationComponentProps,
  NotificationComponentType,
  NotificationControlProps,
  NotificationToggleProps,
} from './types';

export const notificationComponents: NotificationComponentMap = {
  success: ({ setIsOpen }: NotificationToggleProps) => (
    <NotificationSuccess setIsOpen={setIsOpen} />
  ),
  error: ({ setIsOpen, onRetry, loading, errorText }: NotificationComponentProps) => (
    <NotificationError
      setIsOpen={setIsOpen}
      onRetry={onRetry}
      loading={loading}
      errorText={errorText}
    />
  ),
};

function getNotificationComponent(type: keyof NotificationComponentMap): NotificationComponentType {
  if (!notificationComponents[type]) {
    return NotificationError;
  }
  return notificationComponents[type];
}

function Notification({
  type,
  setIsOpen,
  isOpen,
  onRetry,
  loading,
  errorText,
}: NotificationControlProps): React.ReactElement {
  const Component: NotificationComponentType = getNotificationComponent(type);

  return (
    <Fade in={isOpen} timeout={animationTimeout}>
      <Box sx={styles.notificationSection} role="alert" aria-live="polite">
        <Component
          setIsOpen={setIsOpen}
          onRetry={onRetry}
          loading={loading}
          errorText={errorText}
        />
      </Box>
    </Fade>
  );
}

export default Notification;
