import React from 'react';

import { NotificationStatus } from '../AuthSection/AuthForm/types';

export type NotificationType = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export interface NotificationControlProps {
  type: NotificationType;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onRetry: () => void;
}

export type NotificationComponentProps = Pick<NotificationControlProps, 'setIsOpen' | 'onRetry'>;
export type NotificationSuccessProps = Pick<NotificationComponentProps, 'setIsOpen'>;
export type NotificationComponentType = React.FC<NotificationComponentProps>;
export type NotificationComponentMap = Record<NotificationType, NotificationComponentType>;
