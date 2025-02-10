import { Box } from '@mui/material';
import React from 'react';

import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import { NotificationProps, NotificationType } from './types';

function Notification({ type }: NotificationProps): React.ReactElement {

  const notificationComponents: Record<NotificationType, React.FC> = {
    success: NotificationSuccess,
  };

  const Component: React.FC = notificationComponents[type] || NotificationSuccess;
  return (
    <Box sx={styles.notificationSection}>
      <Box sx={styles.notificationWrapper}>
        <Component />
      </Box>
    </Box>
  );
}

export default Notification;
