import React from 'react';

import { AuthenticationProps } from '../AuthSection/AuthFormComponent/types';

export type NotificationType = 'success';

export interface NotificationProps {
  type: NotificationType;
}

export type NotificationVariantComponent = React.FC<Omit<AuthenticationProps, 'isAuthenticated'>>;
export type NotificationComponents = Record<NotificationType, NotificationVariantComponent>;
