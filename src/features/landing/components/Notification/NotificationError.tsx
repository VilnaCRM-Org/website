import { Box, Typography } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import ErrorImg from '../../assets/svg/notification/error.svg';

import styles from './styles';
import { NotificationComponentProps } from './types';

const buttonTextStyle: React.CSSProperties = {
  ...styles.messageButtonText,
  ...styles.errorButtonMessage,
};

function NotificationError({
  setIsOpen,
  onRetry,
  loading,
  errorText,
}: NotificationComponentProps): React.ReactElement {
  const { t } = useTranslation();
  const onHandleClose: () => void = (): void => setIsOpen(false);
  return (
    <Box sx={styles.contentBoxError} aria-invalid="true" aria-label="error" aria-live="polite">
      <Box sx={styles.imageWrapperError}>
        <Image
          src={ErrorImg}
          alt={t('notifications.error.images.error')}
          width={268}
          height={195}
        />
      </Box>

      <Box sx={styles.messageContainerError}>
        <UiTypography component="h4" sx={styles.messageTitle}>
          {t('notifications.error.title')}
        </UiTypography>

        <UiTypography component="span" sx={styles.messageDescription}>
          {errorText || t('failure_responses.client_errors.something_went_wrong')}
        </UiTypography>

        <Box sx={styles.buttonsBox}>
          <UiButton
            sx={styles.errorButton}
            variant="contained"
            type="button"
            size="medium"
            fullWidth
            disabled={loading}
            onClick={onRetry}
          >
            <Typography component="span" sx={buttonTextStyle}>
              {t('notifications.error.retry_button')}
            </Typography>
          </UiButton>

          <UiButton
            sx={{ ...styles.errorButton, marginTop: '0.5rem' }}
            variant="outlined"
            type="button"
            size="medium"
            fullWidth
            onClick={onHandleClose}
          >
            <Typography component="span" sx={buttonTextStyle}>
              {t('notifications.error.button')}
            </Typography>
          </UiButton>
        </Box>
      </Box>
    </Box>
  );
}

export default NotificationError;
