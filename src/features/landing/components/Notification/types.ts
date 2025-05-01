import React from 'react';

export enum NotificationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}
export type LoadingProps = {
  loading: boolean;
};
export interface NotificationControlProps extends LoadingProps {
  type: NotificationStatus;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onRetry: () => void;
}

export type NotificationComponentProps = Pick<NotificationControlProps, 'setIsOpen' | 'onRetry'> &
  LoadingProps;
export type NotificationToggleProps = Pick<NotificationComponentProps, 'setIsOpen'>;
export type NotificationComponentType = React.FC<NotificationComponentProps>;
export type NotificationComponentMap = Record<NotificationStatus, NotificationComponentType>;
