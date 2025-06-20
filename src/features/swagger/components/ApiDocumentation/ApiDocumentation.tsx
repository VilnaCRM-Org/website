import SwaggerUI from 'swagger-ui-react';

import useSwagger from '../../hooks/useSwagger';

function ApiDocumentation(): React.ReactElement | null {
  const { swaggerContent, error } = useSwagger();

  if (error) {
    return <div>Error loading API documentation: {error.message}</div>;
  }

  if (!swaggerContent) {
    return <div>Loading API documentation…</div>;
  }

  return swaggerContent ? <SwaggerUI spec={swaggerContent} /> : null;
}

export default ApiDocumentation;
