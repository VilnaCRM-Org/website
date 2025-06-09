import SwaggerUI from 'swagger-ui-react';

import useSwagger from '../../hooks/useSwagger';

function ApiDocumentation(): React.ReactElement | null {
  const { yamlContent, error } = useSwagger();

  if (error) {
    return <div>Error loading API documentation: {error.message}</div>;
  }

  if (!yamlContent) {
    return <div>Loading API documentation…</div>;
  }

  return yamlContent ? <SwaggerUI spec={yamlContent} /> : null;
}

export default ApiDocumentation;
