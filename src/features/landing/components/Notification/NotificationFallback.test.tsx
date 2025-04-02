import React from 'react';
import { useTranslation } from 'react-i18next';

import UiTypography from '../../../../components/UiTypography';

import styles from './styles';

function NotificationFallback(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <UiTypography component="h4" sx={styles.messageTitle}>
      {t('notifications.unknown.title')}
    </UiTypography>
  );
}

export default NotificationFallback;
