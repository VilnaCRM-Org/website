import { Container } from '@mui/material';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import { UiTypography } from '@/components';

import useSwagger from '../../hooks/useSwagger';


type SwaggerUIProps = { spec?: string | object | undefined };

const SwaggerUI: ComponentType<SwaggerUIProps> = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

function ApiDocumentation(): React.ReactElement | null {
  const { swaggerContent, error } = useSwagger();

  if (error) {
    return (
      <Container>
        <UiTypography>Error loading API documentation: {error.message}</UiTypography>
      </Container>
    );
  }

  return swaggerContent ? <SwaggerUI spec={swaggerContent} /> : null;
}

export default ApiDocumentation;
