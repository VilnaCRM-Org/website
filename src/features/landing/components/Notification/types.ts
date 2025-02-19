import React from 'react';

export type NotificationType = 'success';

export interface NotificationProps {
  type: NotificationType;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export type NotificationVariantComponent = React.FC<Pick<NotificationProps, 'setIsOpen'>>;
export type NotificationComponents = Record<NotificationType, NotificationVariantComponent>;
