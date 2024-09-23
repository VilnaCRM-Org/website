import SwaggerUI from 'swagger-ui-react';

import { useSwagger } from '../../hooks/useSwagger';

const specUr: string = process.env.NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL || '';

function ApiDocumentation(): React.ReactElement {
  const { yamlContent, loading, error } = useSwagger(specUr);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  // return <SwaggerUI url="https://petstore.swagger.io/v2/swagger.json" />;
  return <SwaggerUI spec={yamlContent as string} />;
}

export default ApiDocumentation;
