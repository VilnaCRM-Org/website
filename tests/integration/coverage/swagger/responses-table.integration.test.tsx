/**
 * Permission / auth — Not applicable: the table renders the same for every visitor.
 */
import { render, screen } from '@testing-library/react';
import React, { ComponentType } from 'react';

import {
  OwnedResponses,
  responsesTablePlugin,
  withOwnedResponses,
} from '@swagger/components/api-documentation/responses-table';
import type {
  LiveResponseProps,
  ResponseRowProps,
  ResponsesComponents,
  ResponsesProps,
  SpecPath,
  SwaggerSystem,
} from '@swagger/components/api-documentation/responses-table/types';
import type { ResponseDefinition, ResponseEntry } from '@swagger/types/responses';

import { applySwaggerPlugins } from '../../utils/swagger-plugins';

const rows: ResponseRowProps[] = [];
const live: LiveResponseProps[] = [];

function ResponseStub(props: ResponseRowProps): React.ReactElement {
  const { code } = props;
  rows.push(props);

  return (
    <tr>
      <td>{code}</td>
      <td>Returned for {code}</td>
      <td>No links</td>
    </tr>
  );
}

function LiveResponseStub(props: LiveResponseProps): React.ReactElement {
  live.push(props);

  return <p>Server response</p>;
}

function UpstreamResponses(): React.ReactElement {
  return <p>upstream responses</p>;
}

const components: ResponsesComponents = { liveResponse: LiveResponseStub, response: ResponseStub };

const boundaryTargets: unknown[] = [];

const system: SwaggerSystem = {
  fn: {
    withErrorBoundary: <P extends object>(Wrapped: ComponentType<P>): ComponentType<P> => {
      boundaryTargets.push(Wrapped);

      return function Bounded(props: P): React.ReactElement {
        return (
          <section aria-label="error boundary">
            <Wrapped {...props} />
          </section>
        );
      };
    },
  },
  getComponent: name => components[name],
};

const Responses: ComponentType<ResponsesProps> = applySwaggerPlugins(
  'responses',
  UpstreamResponses,
  system
);

function definition(body?: { size: number } | null): ResponseDefinition {
  return { get: () => body };
}

const specPath: SpecPath = { push: () => specPath };

function propsFor(
  entries: ResponseEntry[],
  overrides: Partial<ResponsesProps> = {}
): ResponsesProps {
  return {
    responses: { entrySeq: () => ({ toArray: () => entries }) },
    getComponent: name => components[name],
    getConfigs: () => ({}),
    specSelectors: { isOAS3: () => true },
    fn: {},
    specPath,
    path: '/api/users',
    method: 'get',
    oas3Selectors: { activeExamplesMember: () => undefined },
    oas3Actions: { setResponseContentType: jest.fn() },
    ...overrides,
  };
}

function flagsOf(key: 'isDefault' | 'controlsAcceptHeader'): string[] {
  return rows.filter(row => row[key]).map(row => row.code);
}

beforeEach(() => {
  rows.length = 0;
  live.length = 0;
});

describe('integration: responses table plugin (#433)', () => {
  it('renders <th scope="col"> headers on a table with no role override for OAS3', () => {
    render(
      <Responses
        {...propsFor([
          ['200', definition({ size: 1 })],
          ['default', definition(null)],
          ['x-internal', definition(null)],
        ])}
      />
    );

    expect(screen.getByRole('region', { name: 'error boundary' })).toBeInTheDocument();
    expect(screen.getByRole('table')).not.toHaveAttribute('role');
    expect(screen.getByRole('table')).toHaveAttribute('id', 'get_api_users_responses');
    expect(screen.getAllByRole('columnheader').map(cell => cell.getAttribute('scope'))).toEqual([
      'col',
      'col',
      'col',
    ]);
    expect(rows.map(row => row.code)).toEqual(['200', 'default']);
    expect(flagsOf('isDefault')).toEqual(['default']);
    expect(flagsOf('controlsAcceptHeader')).toEqual(['200']);
  });

  it('falls back to the default response for the Accept header and to the lowest 2xx', () => {
    render(
      <Responses
        {...propsFor([
          ['201', definition(null)],
          ['200', definition(undefined)],
          ['default', definition({ size: 1 })],
        ])}
      />
    );

    expect(flagsOf('controlsAcceptHeader')).toEqual(['default']);
  });

  it.each<[string, ResponseEntry[], string[]]>([
    ['no default response', [['204', definition(null)]], ['204']],
    ['a default without content', [['default', definition(undefined)]], ['default']],
  ])('has no Accept-controlling response with %s', (_case, entries, defaults) => {
    render(<Responses {...propsFor(entries)} />);

    expect(flagsOf('controlsAcceptHeader')).toEqual([]);
    expect(flagsOf('isDefault')).toEqual(defaults);
  });

  it('renders the live response and marks the answering row', () => {
    render(
      <Responses
        {...propsFor([['200', definition(null)]], { tryItOutResponse: { get: () => 200 } })}
      />
    );

    expect(screen.getByText('Server response')).toBeInTheDocument();
    expect(live[0]?.displayRequestDuration).toBe(false);
    expect(rows[0]?.className).toBe('response_current');
  });

  it('passes displayRequestDuration through and leaves other rows unmarked', () => {
    render(
      <Responses
        {...propsFor([['200', definition(null)]], {
          tryItOutResponse: { get: () => 500 },
          displayRequestDuration: true,
        })}
      />
    );

    expect(live[0]?.displayRequestDuration).toBe(true);
    expect(rows[0]?.className).toBe('');
  });

  it('updates the response content type only for the Accept-controlling response', () => {
    const props: ResponsesProps = propsFor([['200', definition({ size: 1 })]]);
    render(<Responses {...props} />);

    rows[0]!.onContentTypeChange({ controlsAcceptHeader: false, value: 'text/plain' });
    rows[0]!.onContentTypeChange({ controlsAcceptHeader: true, value: 'application/json' });

    expect(props.oas3Actions.setResponseContentType).toHaveBeenCalledTimes(1);
    expect(props.oas3Actions.setResponseContentType).toHaveBeenCalledWith({
      value: 'application/json',
      path: '/api/users',
      method: 'get',
    });
  });

  it.each<[string, ResponseEntry[]]>([
    ['no responses', []],
    ['only extensions', [['x-internal', definition(null)]]],
  ])('renders nothing for %s', (_case, entries) => {
    render(<Responses {...propsFor(entries)} />);

    expect(screen.getByRole('region', { name: 'error boundary' })).toBeEmptyDOMElement();
  });

  it('is registered under responses and keeps the port inside the error boundary', () => {
    expect(responsesTablePlugin.wrapComponents.responses).toBe(withOwnedResponses);
    expect(boundaryTargets).toEqual([OwnedResponses]);
  });

  it('delegates to the upstream component for non-OAS3 specs', () => {
    render(<Responses {...propsFor([], { specSelectors: { isOAS3: () => false } })} />);

    expect(screen.getByText('upstream responses')).toBeInTheDocument();
  });
});
