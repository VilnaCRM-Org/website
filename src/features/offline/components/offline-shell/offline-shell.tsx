import Link from 'next/link';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './styles';

function OfflineShell(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>{t('offline.heading')}</h1>
      <p style={styles.description}>{t('offline.description')}</p>
      <p style={styles.hint}>{t('offline.hint')}</p>
      <Link href="/" style={styles.link}>
        {t('offline.home_link')}
      </Link>
    </div>
  );
}

export default OfflineShell;
