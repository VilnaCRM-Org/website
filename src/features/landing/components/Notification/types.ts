import React from 'react';

export type NotificationType = 'success' | 'error';

export interface NotificationProps {
  type: NotificationType;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  // setType: (type: NotificationType | null) => void;
}

// export type componentVariant = Pick<NotificationProps, 'setType'> & { handleClose: () => void };

// export type NotificationVariantComponent = React.FC<Pick<NotificationProps, 'setType'>> ;
// export type NotificationVariantComponent = React.FC<{ handleClose: () => void }>;
export type NotificationVariantComponent = React.FC<Pick<NotificationProps, 'setIsOpen'>>;
export type NotificationComponentsProps = Record<NotificationType, NotificationVariantComponent>;
