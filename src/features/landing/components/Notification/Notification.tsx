import { Box, Fade } from '@mui/material';
import React from 'react';

import { animationTimeout } from '../../constants';

import NotificationError from './NotificationError';
import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import {
  NotificationProps,
  NotificationComponentsProps,
  NotificationVariantComponent,
} from './types';

export const notificationComponents: NotificationComponentsProps = {
  success: ({ setIsOpen }: Pick<NotificationProps, 'setIsOpen'>) => (
    <NotificationSuccess setIsOpen={setIsOpen} />
  ),
  error: ({ setIsOpen }: Pick<NotificationProps, 'setIsOpen'>) => (
    <NotificationError setIsOpen={setIsOpen} />
  ),
};

function Notification({ type, setIsOpen, isOpen }: NotificationProps): React.ReactElement {
  const Component: NotificationVariantComponent =
    notificationComponents[type] || NotificationSuccess;

  return (
    <Fade in={isOpen} timeout={animationTimeout}>
      <Box sx={styles.notificationSection} data-testid="notification">
        <Box sx={styles.notificationWrapper}>
          <Component setIsOpen={setIsOpen} />
        </Box>
      </Box>
    </Fade>
  );
}

export default Notification;
