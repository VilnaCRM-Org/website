import { Box, Container, Stack } from '@mui/material';
import Image from 'next/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';

import Logo from '../../../assets/svg/logo/Logo.svg';
import { ISocialMedia } from '../../../types/social-media/index';
import { PrivacyPolicy } from '../PrivacyPolicy';
import { SocialMediaList } from '../SocialMediaList';

import { adaptiveStyles } from './styles';

function Adaptive({ socialLinks }: { socialLinks: ISocialMedia[] }) {
  const { t } = useTranslation();

  return (
    <Container sx={adaptiveStyles.wrapper} component="footer">
      <Stack direction="row" justifyContent="space-between" mt="18px" pb="16px">
        <Image src={Logo} alt="Logo" width={131} height={44} />
        <SocialMediaList socialLinks={socialLinks} />
      </Stack>
      <Box sx={adaptiveStyles.gmailWrapper}>
        <UiTypography variant="medium15" sx={adaptiveStyles.gmailText}>
          info@vilnacrm.com
        </UiTypography>
      </Box>
      <PrivacyPolicy />
      <UiTypography variant="medium15" sx={adaptiveStyles.copyright}>
        {t('footer.copyright')}
      </UiTypography>
    </Container>
  );
}

export default Adaptive;
