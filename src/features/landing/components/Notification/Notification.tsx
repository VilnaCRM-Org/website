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
  NotificationSuccessProps,
} from './types';

export const notificationComponents: NotificationComponentMap = {
  success: ({ setIsOpen }: NotificationSuccessProps) => (
    <NotificationSuccess setIsOpen={setIsOpen} />
  ),
  error: ({ setIsOpen, triggerFormSubmit }: NotificationComponentProps) => (
    <NotificationError setIsOpen={setIsOpen} triggerFormSubmit={triggerFormSubmit} />
  ),
};

function Notification({
  type,
  setIsOpen,
  isOpen,
  triggerFormSubmit,
}: NotificationControlProps): React.ReactElement {
  const Component: NotificationComponentType = notificationComponents[type] || NotificationSuccess;

  return (
    <Fade in={isOpen} timeout={animationTimeout}>
      <Box sx={styles.notificationSection} data-testid="notification">
        <Component setIsOpen={setIsOpen} triggerFormSubmit={triggerFormSubmit} />
      </Box>
    </Fade>
  );
}

export default Notification;
