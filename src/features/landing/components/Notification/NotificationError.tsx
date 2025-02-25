import { Box, Typography } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import ErrorImg from '../../assets/svg/notification/error.svg';

import styles from './styles';
import { NotificationProps } from './types';

const buttonTextStyle: React.CSSProperties = {
  ...styles.messageButtonText,
  ...styles.errorButtonMessage,
};

function NotificationError({
  setIsOpen,
}: Pick<NotificationProps, 'setIsOpen'>): React.ReactElement {
  const { t } = useTranslation();
  const onCLick: () => void = (): void => setIsOpen(false);
  return (
    <Box sx={{ ...styles.contentBox, ...styles.contentBoxError }} data-testid="success-box">
      <Box sx={styles.imgWrapper}>
        <Image
          src={ErrorImg}
          alt={t('notifications.error.images.error')}
          width={268}
          height={195}
        />
      </Box>

      <Box sx={{ ...styles.messageContainer, ...styles.messageContainerError }}>
        <UiTypography component="h4" sx={styles.messageTitle}>
          {t('notifications.error.title')}
        </UiTypography>

        <UiTypography component="span" sx={styles.messageDescription}>
          {t('notifications.error.description')}
        </UiTypography>

        <Box sx={styles.buttonsBox}>
          <UiButton
            sx={styles.errorButton}
            variant="contained"
            type="button"
            size="medium"
            fullWidth
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
            onClick={onCLick}
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
