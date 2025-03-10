import React from 'react';

export type NotificationType = 'success' | 'error';

export interface NotificationControlProps {
  type: NotificationType;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  retrySubmit: () => void;
}

export type NotificationComponentProps = Pick<
  NotificationControlProps,
  'setIsOpen' | 'retrySubmit'
>;
export type NotificationSuccessProps = Pick<NotificationComponentProps, 'setIsOpen'>;
export type NotificationComponentType = React.FC<NotificationComponentProps>;
export type NotificationComponentMap = Record<NotificationType, NotificationComponentType>;
