import SwaggerUI from 'swagger-ui-react';

import { useSwagger } from '../../hooks/useSwagger';

const specUrl: string = process.env.NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL ?? '';

function ApiDocumentation(): React.ReactElement | null {
  const { yamlContent } = useSwagger(specUrl);

  return yamlContent ? <SwaggerUI spec={yamlContent} /> : null;
  // return <SwaggerUI url="https://petstore.swagger.io/v2/swagger.json" />;
}

export default ApiDocumentation;