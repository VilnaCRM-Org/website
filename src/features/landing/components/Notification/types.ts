import React from 'react';

export enum NotificationStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}
export type ErrorInfo = {
  loading: boolean;
  errorText?: string;
};
export interface NotificationControlProps extends ErrorInfo {
  type: NotificationStatus;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onRetry: () => void;
}

export type NotificationComponentProps = Pick<NotificationControlProps, 'setIsOpen' | 'onRetry'> &
  ErrorInfo;
export type NotificationToggleProps = Pick<NotificationComponentProps, 'setIsOpen'>;
export type NotificationComponentType = React.FC<NotificationComponentProps>;
export type NotificationComponentMap = Record<NotificationStatus, NotificationComponentType>;
