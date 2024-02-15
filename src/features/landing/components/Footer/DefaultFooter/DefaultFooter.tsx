import { Box, Stack } from '@mui/material';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';

import { DefaultTypography } from '@/components/UiTypography';

import Logo from '../../../assets/svg/logo/Logo.svg';
import { SocialMedia } from '../../../types/social-media';
import SocialMediaList from '../../SocialMedia/SocialMediaList/SocialMediaList';
import { PrivacyPolicy } from '../PrivacyPolicy';
import { VilnaCRMGmail } from '../VilnaCRMGmail';

import styles from './styles';

function DefaultFooter({
  socialLinks,
}: {
  socialLinks: SocialMedia[];
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack sx={styles.footerWrapper}>
      <Stack height="4.188rem" alignItems="center" flexDirection="row">
        <Box sx={styles.topWrapper}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Image
              src={Logo}
              alt={t('footer.logo_alt')}
              width={143}
              height={48}
            />
            <PrivacyPolicy />
          </Stack>
        </Box>
      </Stack>
      <Stack sx={styles.copyrightAndLinksWrapper}>
        <Box sx={styles.bottomWrapper}>
          <Stack sx={styles.copyrightAndLinks}>
            <DefaultTypography variant="medium15" sx={styles.copyright}>
              {t('footer.copyright')}
            </DefaultTypography>
            <Stack direction="row" gap="0.875rem" alignItems="center">
              <VilnaCRMGmail />
              <SocialMediaList socialLinks={socialLinks} />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
}

export default DefaultFooter;
