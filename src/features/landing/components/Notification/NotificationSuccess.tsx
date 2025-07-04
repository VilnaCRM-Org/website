import { Box, Typography } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import Confetti from '../../assets/svg/notification/confetti.svg';
import Settings from '../../assets/svg/notification/settings.svg';

import styles from './styles';
import { NotificationToggleProps } from './types';

function NotificationSuccess({ setIsOpen }: NotificationToggleProps): React.ReactElement {
  const { t } = useTranslation();
  const handleClick: () => void = (): void => setIsOpen(false);

  return (
    <Box sx={styles.contentBox} aria-label="success" aria-live="polite">
      <Box sx={styles.successTopImgBox}>
        <Image src={Confetti} alt={t('notifications.success.images.confetti')} />
      </Box>
      <Box sx={styles.gears}>
        <Image
          src={Settings}
          alt={t('notifications.success.images.gears')}
          width={164}
          height={164}
        />
      </Box>

      <Box sx={styles.messageContainer}>
        <UiTypography component="h4" sx={styles.messageTitle}>
          {t('notifications.success.title')}
        </UiTypography>

        <UiTypography component="span" sx={styles.messageDescription}>
          {t('notifications.success.description')}
        </UiTypography>

        <UiButton
          sx={styles.messageButton}
          variant="contained"
          type="button"
          size="medium"
          fullWidth
          onClick={handleClick}
        >
          <Typography component="span" sx={styles.messageButtonText}>
            {t('notifications.success.button')}
          </Typography>
        </UiButton>
      </Box>
      <Box sx={styles.bottomImgBox}>
        <Image src={Confetti} alt="" aria-hidden="true" />
      </Box>
    </Box>
  );
}

export default NotificationSuccess;
