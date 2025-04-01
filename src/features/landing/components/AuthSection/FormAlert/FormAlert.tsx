import React from 'react';

import { UiTypography } from '@/components';

import styles from './styles';

function FormAlert({ apiErrorDetails }: { apiErrorDetails: string }): React.ReactElement {
  return (
    <UiTypography variant="medium14" sx={styles.errorText} role="alert" aria-live="assertive">
      {apiErrorDetails}
    </UiTypography>
  );
}
export default FormAlert;
