import { Container } from '@mui/material';
import SwaggerUI from 'swagger-ui-react';

import { UiTypography } from '@/components';

import useSwagger from '../../hooks/useSwagger';

function ApiDocumentation(): React.ReactElement | null {
  const { swaggerContent, error } = useSwagger();

  if (error) {
    return (
      <Container>
        <UiTypography>Error loading API documentation: {error.message}</UiTypography>
      </Container>
    );
  }

  if (!swaggerContent) {
    return null;
  }

  return swaggerContent ? <SwaggerUI spec={swaggerContent} /> : null;
}

export default ApiDocumentation;
