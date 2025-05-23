import { Box, Fade } from '@mui/material';
import React from 'react';

import { animationTimeout } from '../../constants';

import NotificationError from './NotificationError';
import NotificationFallback from './NotificationFallback';
import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import {
  NotificationComponentMap,
  NotificationComponentProps,
  NotificationComponentType,
  NotificationControlProps,
  NotificationSuccessProps,
} from './types';

export const notificationComponents: NotificationComponentMap = {
  success: ({ setIsOpen }: NotificationSuccessProps) => (
    <NotificationSuccess setIsOpen={setIsOpen} />
  ),
  error: ({ setIsOpen, onRetry }: NotificationComponentProps) => (
    <NotificationError setIsOpen={setIsOpen} onRetry={onRetry} />
  ),
};

function getNotificationComponent(type: keyof NotificationComponentMap): NotificationComponentType {
  if (!notificationComponents[type]) {
    return NotificationFallback;
  }
  return notificationComponents[type];
}

function Notification({
  type,
  setIsOpen,
  isOpen,
  onRetry,
}: NotificationControlProps): React.ReactElement {
  const Component: NotificationComponentType = getNotificationComponent(type);

  return (
    <Fade in={isOpen} timeout={animationTimeout}>
      <Box sx={styles.notificationSection} role="alert" aria-live="polite">
        <Component setIsOpen={setIsOpen} onRetry={onRetry} />
      </Box>
    </Fade>
  );
}

export default Notification;
