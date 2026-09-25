import { render, screen, within } from '@testing-library/react';
import type { AxeResults } from 'axe-core';
import { axe } from 'jest-axe';
import React, { ComponentType } from 'react';

import {
  OwnedResponses,
  responsesTablePlugin,
  withOwnedResponses,
} from '@swagger/components/api-documentation/responses-table';
import type {
  LiveResponseProps,
  OwnedResponsesProps,
  ResponseRowProps,
  ResponsesComponents,
  ResponsesProps,
  SpecPath,
  SwaggerSystem,
} from '@swagger/components/api-documentation/responses-table/types';
import type { ResponseDefinition, ResponseEntry } from '@swagger/types/responses';

import { FORCED_RULES } from '../a11y/axe-config';
import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

/**
 * Collections are duck-typed: `immutable` resolves the hoisted v5, not swagger-ui's v3.
 * Permission / auth — Not applicable: the table renders the same for every visitor.
 */
function content(size: number): { size: number } {
  return { size };
}

function definition(body?: { size: number } | null): ResponseDefinition {
  return { get: () => body };
}

function specPathOf(segments: readonly string[]): SpecPath & { segments: readonly string[] } {
  return { segments, push: key => specPathOf([...segments, key]) };
}

const rendered: ResponseRowProps[] = [];
const liveRendered: LiveResponseProps[] = [];

function ResponseStub(props: ResponseRowProps): React.ReactElement {
  const { code, className } = props;
  rendered.push(props);

  return (
    <tr className={`response ${className}`}>
      <td className="response-col_status">{code}</td>
      <td className="response-col_description">Returned for {code}</td>
      <td className="response-col_links">No links</td>
    </tr>
  );
}

function LiveResponseStub(props: LiveResponseProps): React.ReactElement {
  const { response } = props;
  liveRendered.push(props);

  return <div>Server response {String(response.get('status'))}</div>;
}

const components: ResponsesComponents = { liveResponse: LiveResponseStub, response: ResponseStub };

const STANDARD: ResponseEntry[] = [
  ['200', definition(content(1))],
  ['400', definition(content(1))],
  ['default', definition(null)],
  ['x-rate-limit', definition(null)],
];

function baseProps(overrides: Partial<ResponsesProps> = {}): ResponsesProps {
  const entries: ResponseEntry[] = STANDARD;

  return {
    responses: { entrySeq: () => ({ toArray: () => entries }) },
    getComponent: name => components[name],
    getConfigs: () => ({}),
    specSelectors: { isOAS3: () => true },
    fn: {},
    producesValue: 'application/json',
    specPath: specPathOf(['paths', '/api/users', 'get', 'responses']),
    path: '/api/users',
    method: 'get',
    oas3Selectors: { activeExamplesMember: (_path, _method, _type, code) => `example-${code}` },
    oas3Actions: { setResponseContentType: jest.fn() },
    ...overrides,
  };
}

function propsFor(overrides: Partial<OwnedResponsesProps> = {}): OwnedResponsesProps {
  return { ...baseProps(), components, ...overrides };
}

function withEntries(entries: ResponseEntry[]): Partial<OwnedResponsesProps> {
  return { responses: { entrySeq: () => ({ toArray: () => entries }) } };
}

function UpstreamResponsesTable(): React.ReactElement {
  return (
    <table
      aria-live="polite"
      className="responses-table"
      id="get_api_users_responses"
      role="region"
    >
      <thead>
        <tr className="responses-header">
          <td className="col_header response-col_status">Code</td>
          <td className="col_header response-col_description">Description</td>
          <td className="col col_header response-col_links">Links</td>
        </tr>
      </thead>
      <tbody>
        {['200', '400', 'default'].map(code => (
          <tr key={code} className="response">
            <td className="response-col_status">{code}</td>
            <td className="response-col_description">Returned for {code}</td>
            <td className="response-col_links">No links</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function tdHasHeaderViolations(container: HTMLElement): Promise<number> {
  const results: AxeResults = (await axe(container, {
    runOnly: { type: 'rule', values: ['td-has-header'] },
    rules: FORCED_RULES,
  })) as AxeResults;

  return results.violations.length;
}

beforeEach(() => {
  rendered.length = 0;
  liveRendered.length = 0;
});

describe('OwnedResponses (#433 td-has-header)', () => {
  it('heads every column with a <th scope="col">', () => {
    render(<OwnedResponses {...propsFor()} />);

    const headers: HTMLElement[] = screen.getAllByRole('columnheader');

    expect(headers.map(header => header.textContent)).toEqual(['Code', 'Description', 'Links']);
    headers.forEach(header => {
      expect(header.tagName).toBe('TH');
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  it('exposes a real table: no role override, same id, classes and live region', () => {
    render(<OwnedResponses {...propsFor()} />);

    const table: HTMLElement = screen.getByRole('table');

    expect(table).not.toHaveAttribute('role');
    expect(table).toHaveAttribute('id', 'get_api_users_responses');
    expect(table).toHaveAttribute('aria-live', 'polite');
    expect(table).toHaveClass('responses-table');
    expect(table.closest('.responses-inner')?.parentElement).toHaveClass('responses-wrapper');
  });

  it('associates each data cell with its column header', () => {
    render(<OwnedResponses {...propsFor()} />);

    const [, firstRow] = within(screen.getByRole('table')).getAllByRole('row');

    expect(within(firstRow!).getByRole('cell', { name: '200' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[0]).toHaveAccessibleName('Code');
  });

  it('fails td-has-header on the upstream markup and passes on the port', async () => {
    const upstream: HTMLElement = render(<UpstreamResponsesTable />).container;
    const owned: HTMLElement = render(<OwnedResponses {...propsFor()} />).container;

    await expect(tdHasHeaderViolations(upstream)).resolves.toBe(1);
    await expect(tdHasHeaderViolations(owned)).resolves.toBe(0);
    await expectNoA11yViolations(owned);
  });

  it('renders one Response per documented code, skipping x- extensions', () => {
    render(<OwnedResponses {...propsFor()} />);

    expect(rendered.map(row => row.code)).toEqual(['200', '400', 'default']);
  });

  it('hands each Response the props upstream passes', () => {
    const props: OwnedResponsesProps = propsFor();
    render(<OwnedResponses {...props} />);

    const [ok, badRequest, fallback] = rendered;

    expect(ok).toMatchObject({
      path: '/api/users',
      method: 'get',
      contentType: 'application/json',
      activeExamplesKey: 'example-200',
      controlsAcceptHeader: true,
      isDefault: false,
      className: '',
      fn: props.fn,
      getConfigs: props.getConfigs,
      getComponent: props.getComponent,
      specSelectors: props.specSelectors,
      oas3Actions: props.oas3Actions,
    });
    expect((ok!.specPath as ReturnType<typeof specPathOf>).segments).toEqual([
      'paths',
      '/api/users',
      'get',
      'responses',
      '200',
    ]);
    expect(badRequest).toMatchObject({ controlsAcceptHeader: false, isDefault: false });
    expect(fallback).toMatchObject({ controlsAcceptHeader: false, isDefault: true });
  });

  it('marks the lowest 2xx as default when no default response exists', () => {
    render(
      <OwnedResponses
        {...propsFor(
          withEntries([
            ['404', definition(null)],
            ['201', definition(null)],
            ['200', definition(null)],
          ])
        )}
      />
    );

    expect(rendered.filter(row => row.isDefault).map(row => row.code)).toEqual(['200']);
  });

  it('forwards a content-type change only for the accept-controlling response', () => {
    const props: OwnedResponsesProps = propsFor();
    render(<OwnedResponses {...props} />);

    rendered[1]!.onContentTypeChange({ controlsAcceptHeader: false, value: 'text/plain' });
    expect(props.oas3Actions.setResponseContentType).not.toHaveBeenCalled();

    rendered[0]!.onContentTypeChange({ controlsAcceptHeader: true, value: 'application/xml' });
    expect(props.oas3Actions.setResponseContentType).toHaveBeenCalledWith({
      value: 'application/xml',
      path: '/api/users',
      method: 'get',
    });
  });

  it('renders no live response block before the operation is executed', () => {
    render(<OwnedResponses {...propsFor({ tryItOutResponse: null })} />);

    expect(screen.queryByText(/Server response/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Responses', level: 4 })).toHaveLength(1);
    expect(liveRendered).toEqual([]);
  });

  it('renders the live response and highlights the row that answered', () => {
    const props: OwnedResponsesProps = propsFor({ tryItOutResponse: { get: () => 400 } });
    render(<OwnedResponses {...props} />);

    expect(screen.getByText('Server response 400')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Responses', level: 4 })).toHaveLength(2);
    expect(rendered.map(row => row.className)).toEqual(['', 'response_current', '']);
    expect(liveRendered[0]).toMatchObject({
      path: '/api/users',
      method: 'get',
      displayRequestDuration: false,
      getComponent: props.getComponent,
      getConfigs: props.getConfigs,
      specSelectors: props.specSelectors,
    });
  });

  it('passes displayRequestDuration through when swagger-ui sets it', () => {
    render(
      <OwnedResponses
        {...propsFor({ tryItOutResponse: { get: () => 200 }, displayRequestDuration: true })}
      />
    );

    expect(liveRendered[0]?.displayRequestDuration).toBe(true);
  });

  it.each<[string, ResponseEntry[]]>([
    ['no responses', []],
    ['only extensions', [['x-internal', definition(content(1))]]],
  ])('renders nothing for %s', (_case, entries) => {
    const { container } = render(<OwnedResponses {...propsFor(withEntries(entries))} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('withOwnedResponses', () => {
  function UpstreamResponses(): React.ReactElement {
    return <p>upstream responses</p>;
  }

  const boundaryTargets: jest.Mock = jest.fn();

  function makeSystem(): SwaggerSystem {
    return {
      fn: {
        withErrorBoundary: <P extends object>(Wrapped: ComponentType<P>): ComponentType<P> => {
          boundaryTargets(Wrapped);

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
  }

  function responsesProps(isOAS3: boolean): ResponsesProps {
    return baseProps({ specSelectors: { isOAS3: () => isOAS3 } });
  }

  it('renders the owned table inside swagger-ui error boundary for OAS3 specs', () => {
    const Wrapped: ComponentType<ResponsesProps> = withOwnedResponses(
      UpstreamResponses,
      makeSystem()
    );

    render(<Wrapped {...responsesProps(true)} />);

    expect(boundaryTargets.mock.calls).toEqual([[OwnedResponses]]);
    const boundary: HTMLElement = screen.getByRole('region', { name: 'error boundary' });
    expect(within(boundary).getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.queryByText('upstream responses')).not.toBeInTheDocument();
  });

  it('resolves Response and LiveResponse from the system once, at wrap time', () => {
    const system: SwaggerSystem = makeSystem();
    const getComponent: jest.SpyInstance = jest.spyOn(system, 'getComponent');

    const Wrapped: ComponentType<ResponsesProps> = withOwnedResponses(UpstreamResponses, system);
    render(<Wrapped {...responsesProps(true)} />);

    expect(getComponent.mock.calls).toEqual([['liveResponse'], ['response']]);
    expect(rendered).toHaveLength(3);
  });

  it('delegates to the upstream component for non-OAS3 specs', () => {
    const Wrapped: ComponentType<ResponsesProps> = withOwnedResponses(
      UpstreamResponses,
      makeSystem()
    );

    render(<Wrapped {...responsesProps(false)} />);

    expect(screen.getByText('upstream responses')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('is registered under the responses key swagger-ui looks up', () => {
    expect(responsesTablePlugin.wrapComponents.responses).toBe(withOwnedResponses);
  });
});
