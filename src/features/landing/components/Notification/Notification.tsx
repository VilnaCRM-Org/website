import { Box } from '@mui/material';
import React from 'react';

import { AuthFormProps } from '../AuthSection/AuthForm/types';

import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import { NotificationProps, NotificationType } from './types';

const notificationComponents: Record<
  NotificationType,
  React.FC<Omit<AuthFormProps, 'isAuthenticated'>>
> = {
  success: ({ setIsAuthenticated }: Omit<AuthFormProps, 'isAuthenticated'>) => (
    <NotificationSuccess setIsAuthenticated={setIsAuthenticated} />
  ),
};

function Notification({
  type,
  setIsAuthenticated,
  isAuthenticated,
}: NotificationProps & AuthFormProps): React.ReactElement {
  const Component: React.FC<Omit<AuthFormProps, 'isAuthenticated'>> =
    notificationComponents[type] || NotificationSuccess;

  return (
    <Box
      sx={{
        ...styles.notificationSection,
        ...(isAuthenticated ? styles.isVisible : styles.isHidden),
      }}
      data-testid='notification'
    >
      <Box sx={styles.notificationWrapper}>
        <Component setIsAuthenticated={setIsAuthenticated} />
      </Box>
    </Box>
  );
}

export default Notification;
