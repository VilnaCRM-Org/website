import { Box, Fade } from '@mui/material';
import React from 'react';

import { animationTimeout } from '../../constants';

import NotificationError from './NotificationError';
import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import {
  NotificationComponentMap,
  NotificationComponentType,
  NotificationControlProps,
} from './types';

export const notificationComponents: NotificationComponentMap = {
  success: NotificationSuccess,
  error: NotificationError,
};

function Notification({
  type,
  setIsOpen,
  isOpen,
  onRetry,
  loading,
  errorText,
}: NotificationControlProps): React.ReactElement {
  const Component: NotificationComponentType = notificationComponents[type] ?? NotificationError;

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
