/**
 * Integration coverage for the servers-label plugin (#424): the wrapper is exercised
 * around a stub that emits swagger-ui's real container markup, and `ApiDocumentation`
 * is proved to hand the plugin to `SwaggerUI` (the stub records its props), so the
 * page-level wiring is covered as well as the component.
 *
 * Invalid input / boundary — the empty and missing server lists are the boundary and
 * are covered below. Loading / error — Not applicable: synchronous wrapper.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ApiDocumentation from '../../../../src/features/swagger/components/api-documentation';
import {
  swaggerPlugins,
  withServersLabel,
} from '../../../../src/features/swagger/components/api-documentation/servers';
import { ServersContainerProps } from '../../../../src/features/swagger/components/api-documentation/servers/types';
import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

jest.mock('../../../../src/features/swagger/hooks/useSwagger');

const receivedProps: { plugins?: unknown }[] = [];

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: function SwaggerUI(props: { plugins?: unknown }): React.ReactElement {
    receivedProps.push(props);
    return <div>SwaggerUI rendered</div>;
  },
}));

function UpstreamServersContainer(): React.ReactElement {
  return (
    <select id="servers">
      <option value="http://mockoon:8080">http://mockoon:8080</option>
    </select>
  );
}

const Labelled: React.ComponentType<ServersContainerProps> = withServersLabel(
  UpstreamServersContainer
);

describe('integration: servers label plugin', () => {
  it('names the upstream select through a for-association', () => {
    render(<Labelled specSelectors={{ servers: () => ({ size: 1 }) }} />);

    expect(screen.getByLabelText(t('api_documentation.servers_label'))).toHaveAttribute(
      'id',
      'servers'
    );
  });

  it.each([{ size: 0 }, null, undefined])('renders nothing when the list is %p', servers => {
    const { container } = render(<Labelled specSelectors={{ servers: () => servers }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('is passed to SwaggerUI by ApiDocumentation', () => {
    jest.mocked(useSwagger).mockReturnValue({
      error: null,
      swaggerContent: { openapi: '3.0.0' },
    });

    render(<ApiDocumentation />);

    expect(screen.getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
    expect(receivedProps[receivedProps.length - 1]?.plugins).toBe(swaggerPlugins);
  });
});
