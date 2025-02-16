import { Box } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import Confetti from '../../assets/svg/notification/confetti.svg';
import Settings from '../../assets/svg/notification/settings.svg';
import { AuthenticationProps } from '../AuthSection/AuthFormComponent/types';

import styles from './styles';

function NotificationSuccess({
  setIsAuthenticated,
}: Omit<AuthenticationProps, 'isAuthenticated'>): React.ReactElement {
  const { t } = useTranslation();
  const handleClick: () => void = (): void => setIsAuthenticated(false);

  return (
    <Box sx={styles.successBox} data-testid="success-box">
      <Box sx={styles.successImgBox}>
        <Image
          src={Confetti}
          data-testid="confetti"
          alt={t('notifications.success.images.confetti')}
        />
      </Box>

      <Box sx={styles.imgWrapper}>
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
          {t('notifications.success.button')}
        </UiButton>

        <Box sx={{ ...styles.successImgBox, ...styles.bottomImgBox }}>
          <Image src={Confetti} alt={t('notifications.success.images.confetti')} />
        </Box>
      </Box>
    </Box>
  );
}

export default NotificationSuccess;
