import { Box } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';

import { UiButton } from '@/components';

import UiTypography from '../../../../components/UiTypography';
import Confetti from '../../assets/svg/notification/confetti.svg';
import Settings from '../../assets/svg/notification/settings.svg';

import styles from './styles';

function NotificationSuccess(): React.ReactElement {
  const handleClick: () => void = (): void => {};

  return (
    <Box sx={styles.successBox}>
      <Box sx={styles.successImg}>
        <Image src={Confetti} alt="confetti" />
      </Box>

      <Box sx={styles.imgWrapper}>
        <Image src={Settings} alt="settings" width={164} height={164} />
      </Box>

      <Box sx={styles.messageContainer}>
        <UiTypography component="h4" sx={styles.messageTitle}>
          Вітаємо!
        </UiTypography>
        <UiTypography component="span" sx={styles.messageDescription}>
          Ви успішно налаштували проєкт
        </UiTypography>

        <UiButton
          sx={styles.messageButton}
          variant="contained"
          type="button"
          size="medium"
          fullWidth
          onClick={handleClick}
        >
          На головну проєкту
        </UiButton>
      </Box>
    </Box>
  );
}

export default NotificationSuccess;
