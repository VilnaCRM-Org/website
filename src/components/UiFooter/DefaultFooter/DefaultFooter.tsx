import { Box, Stack } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';


import Logo from '@/assets/svg/logo/Logo.svg';
import { SocialMediaList } from '@/components/SocialMedia';
import UiTypography from '@/components/UiTypography';
import { SocialMedia } from '@/types/social-media';

import { PrivacyPolicy } from '../PrivacyPolicy';
import { VilnaCRMEmail } from '../VilnaCRMEmail';

import styles from './styles';

function DefaultFooter({ socialLinks }: { socialLinks: SocialMedia[] }): React.ReactElement {
  const { t } = useTranslation();

  const currentDate: Date = useMemo(() => new Date(), []);
  const currentYear: number = useMemo(() => currentDate.getFullYear(), [currentDate]);

  return (
    <Stack sx={styles.footerWrapper}>
      <Stack direction="row" sx={{ height: '4.188rem', alignItems: 'center' }}>
        <Box sx={styles.topWrapper}>
          <Stack
            direction="row"
            sx={[styles.topContent, { justifyContent: 'space-between', alignItems: 'center' }]}
          >
            <Image src={Logo} alt={t('footer.logo_alt')} width={143} height={48} />
            <PrivacyPolicy />
          </Stack>
        </Box>
      </Stack>
      <Box sx={styles.bottomWrapper}>
        <Stack sx={styles.copyrightAndLinksWrapper}>
          <Stack sx={styles.copyrightAndLinks}>
            <UiTypography variant="medium15" sx={styles.copyright}>
              {t('footer.copyright')}, <Box component="span">{currentYear}</Box>
            </UiTypography>
            <Stack direction="row" sx={{ gap: '0.875rem', alignItems: 'center' }}>
              <VilnaCRMEmail />
              <SocialMediaList socialLinks={socialLinks} />
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

export default DefaultFooter;
