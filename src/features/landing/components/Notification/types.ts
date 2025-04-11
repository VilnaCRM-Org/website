import React from 'react';

export enum NotificationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface NotificationControlProps {
  type: NotificationStatus;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onRetry: () => void;
}

export type NotificationComponentProps = Pick<NotificationControlProps, 'setIsOpen' | 'onRetry'>;
export type NotificationToggleProps = Pick<NotificationComponentProps, 'setIsOpen'>;
export type NotificationComponentType = React.FC<NotificationComponentProps>;
export type NotificationComponentMap = Record<NotificationStatus, NotificationComponentType>;
