import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import { useSwagger } from '../../hooks/useSwagger';



// Явно указываем, что SwaggerUI — компонент с пропсом spec, который может быть string | object | null | undefined
type SwaggerUIProps = { spec?: string | object | undefined };

const SwaggerUI: ComponentType<SwaggerUIProps> = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

const specUrl: string = process.env.NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL ?? '';

function ApiDocumentation(): React.ReactElement | null {
  const { yamlContent } = useSwagger(specUrl);

  return yamlContent ? <SwaggerUI spec={yamlContent} /> : null;
}

export default ApiDocumentation;
