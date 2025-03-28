import React from 'react';

import { UiTypography } from '@/components';

import styles from './styles';

function FormAlert({ errorDetails }: { errorDetails: string }): React.ReactElement {
  return (
    <UiTypography variant="medium14" sx={styles.errorText} role="alert" aria-live="assertive">
      {errorDetails}
    </UiTypography>
  );
}
export default FormAlert;
