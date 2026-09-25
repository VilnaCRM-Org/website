import { CircularProgress, Container } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiTypography } from '@/components';

import styles from './styles';

function Loading(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Container role="status" sx={styles.container}>
      <CircularProgress color="primary" size={70} sx={styles.spinner} aria-hidden="true" />
      <UiTypography component="span" sx={styles.visuallyHidden}>
        {t('api_documentation.loading')}
      </UiTypography>
    </Container>
  );
}

export default Loading;
