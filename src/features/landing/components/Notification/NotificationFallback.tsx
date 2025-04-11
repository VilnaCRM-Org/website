import { Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';

import styles from './styles';
import { NotificationToggleProps } from './types';

function NotificationFallback({ setIsOpen }: NotificationToggleProps): React.ReactElement {
  const { t } = useTranslation();
  const onHandleClose: () => void = (): void => setIsOpen(false);
  return (
    <>
      <UiTypography component="h4" sx={styles.messageTitle} role="alert" aria-live="polite">
        {t('notifications.unknown.title')}
      </UiTypography>
      <UiButton
        sx={styles.messageButton}
        variant="contained"
        type="button"
        size="medium"
        fullWidth
        onClick={onHandleClose}
      >
        <Typography component="span" sx={styles.messageButtonText}>
          {t('notifications.unknown.button')}
        </Typography>
      </UiButton>
    </>
  );
}

export default NotificationFallback;
