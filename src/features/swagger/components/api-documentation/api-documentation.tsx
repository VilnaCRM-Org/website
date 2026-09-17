import { Container } from '@mui/material';
import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SwaggerUI from 'swagger-ui-react';

import { UiButton, UiTypography } from '@/components';

import useSwagger from '../../hooks/useSwagger';
import { Loading } from '../loading';

import { swaggerPlugins } from './servers';
import styles from './styles';

function LoadError({
  onRetry,
  focusRetry,
}: {
  onRetry: () => void;
  focusRetry: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const messageId: string = useId();
  const retryButton: React.RefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusRetry) retryButton.current?.focus();
  }, [focusRetry]);

  return (
    <Container sx={styles.errorWrapper}>
      <UiTypography id={messageId} role="alert" variant="bodyText18">
        {t('api_documentation.error.message')}
      </UiTypography>
      <UiButton
        ref={retryButton}
        variant="contained"
        size="small"
        onClick={onRetry}
        aria-describedby={messageId}
      >
        {t('api_documentation.error.retry')}
      </UiButton>
    </Container>
  );
}

function ApiDocumentation(): React.ReactElement {
  const { t } = useTranslation();
  const { swaggerContent, error, loading, retry } = useSwagger();
  const [retried, setRetried] = useState<boolean>(false);

  const handleRetry: () => void = (): void => {
    setRetried(true);
    retry();
  };

  return (
    <>
      <UiTypography component="span" role="status" sx={styles.visuallyHidden}>
        {swaggerContent ? t('api_documentation.loaded') : ''}
      </UiTypography>
      {loading && <Loading />}
      {error && <LoadError onRetry={handleRetry} focusRetry={retried} />}
      {swaggerContent ? <SwaggerUI spec={swaggerContent} plugins={swaggerPlugins} /> : null}
    </>
  );
}

export default ApiDocumentation;
