import { Box } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import Confetti from '../../assets/svg/notification/confetti.svg';
import Settings from '../../assets/svg/notification/settings.svg';
import { AuthFormProps } from '../AuthSection/AuthForm/types';

import styles from './styles';

function NotificationSuccess({
  setIsAuthenticated,
}: Omit<AuthFormProps, 'isAuthenticated'>): React.ReactElement {
  const { t } = useTranslation();
  const handleClick: () => void = (): void => setIsAuthenticated(false);

  return (
    <Box sx={styles.successBox}>
      <Box sx={styles.successImgBox}>
        <Image src={Confetti} alt="confetti" />
      </Box>

      <Box sx={styles.imgWrapper}>
        <Image src={Settings} alt="settings" width={164} height={164} />
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
          <Image src={Confetti} alt="confetti" />
        </Box>
      </Box>
    </Box>
  );
}

export default NotificationSuccess;
