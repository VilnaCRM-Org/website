import { Box, Fade } from '@mui/material';
import React from 'react';

import { animationTimeout } from '../../constants';
import { AuthenticationProps } from '../AuthSection/AuthFormComponent/types';

import NotificationSuccess from './NotificationSuccess';
import styles from './styles';
import { NotificationProps, NotificationComponents, NotificationVariantComponent } from './types';


const notificationComponents: NotificationComponents = {
  success: ({ setIsAuthenticated }: Omit<AuthenticationProps, 'isAuthenticated'>) => (
    <NotificationSuccess setIsAuthenticated={setIsAuthenticated} />
  ),
};

function Notification({
  type,
  setIsAuthenticated,
  isAuthenticated,
}: NotificationProps & AuthenticationProps): React.ReactElement {
  const Component: NotificationVariantComponent =
    notificationComponents[type] || NotificationSuccess;

  return (
    <Fade in={isAuthenticated} timeout={animationTimeout}>
      <Box sx={styles.notificationSection} data-testid="notification">
        <Box sx={styles.notificationWrapper}>
          <Component setIsAuthenticated={setIsAuthenticated} />
        </Box>
      </Box>
    </Fade>
  );
}

export default Notification;
