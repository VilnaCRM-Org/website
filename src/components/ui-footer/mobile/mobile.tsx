import { Box, Container, Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Logo from '@/assets/svg/logo/Logo.svg';
import { SocialMediaList } from '@/components/social-media';
import UiTypography from '@/components/ui-typography';
import { SocialMedia } from '@/types/social-media';

import { PrivacyPolicy } from '../privacy-policy';
import { VilnaCRMEmail } from '../vilna-crm-email';

import styles from './styles';

function Mobile({ socialLinks }: { socialLinks: SocialMedia[] }): React.ReactElement {
  const { t } = useTranslation();
  const currentDate: Date = useMemo(() => new Date(), []);
  const currentYear: number = useMemo(() => currentDate.getFullYear(), [currentDate]);
  return (
    <Container sx={styles.wrapper}>
      <Stack sx={styles.content}>
        <Image src={Logo} alt={t('footer.logo_alt')} width={131} height={44} />
        <SocialMediaList socialLinks={socialLinks} />
      </Stack>
      <VilnaCRMEmail />
      <PrivacyPolicy />
      <UiTypography variant="medium15" sx={styles.copyright}>
        {t('footer.copyright')}, <Box component="span">{currentYear}</Box>
      </UiTypography>
    </Container>
  );
}

export default Mobile;
