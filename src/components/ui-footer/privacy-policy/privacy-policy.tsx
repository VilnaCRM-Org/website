import { Link, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';
import { env } from '@/config/env';

import styles from './styles';

function PrivacyPolicy(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack direction="row" sx={[styles.wrapper, { alignItems: 'center' }]}>
      <Link
        target="_blank"
        rel="noopener noreferrer"
        sx={styles.privacy}
        href={env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL}
      >
        <UiTypography variant="medium16" sx={styles.textColor}>
          {t('footer.privacy')}
        </UiTypography>
      </Link>
      <Link
        target="_blank"
        rel="noopener noreferrer"
        sx={styles.usage_policy}
        href={env.NEXT_PUBLIC_VILNACRM_USE_POLICY_URL}
      >
        <UiTypography variant="medium16" sx={styles.textColor}>
          {t('footer.usage_policy')}
        </UiTypography>
      </Link>
    </Stack>
  );
}

export default PrivacyPolicy;
