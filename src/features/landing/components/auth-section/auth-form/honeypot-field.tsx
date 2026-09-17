import { Box } from '@mui/material';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './styles';
import { AuthFormProps } from './types';

const HONEYPOT_ID: string = 'sign-up-referral';

function HoneypotField({ control }: Pick<AuthFormProps, 'control'>): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      name="Referral"
      render={({ field: { name, value, onChange } }) => (
        <Box inert aria-hidden="true" sx={styles.visuallyHidden}>
          <label htmlFor={HONEYPOT_ID}>{t('sign_up.form.honeypot.label')}</label>
          <input
            id={HONEYPOT_ID}
            name={name}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={value}
            onChange={onChange}
          />
        </Box>
      )}
    />
  );
}

export default HoneypotField;
