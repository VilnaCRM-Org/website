import React from 'react';

import {
  acceptControllingResponse,
  defaultStatusCode,
  htmlReadyId,
} from '../../../helpers/response-helpers';

import {
  OwnedResponsesProps,
  ResponseRowItemProps,
  ResponsesTableProps,
  RowState,
  SharedRowProps,
} from './types';

function sharedRowProps(context: OwnedResponsesProps): SharedRowProps {
  const { path, method, oas3Actions } = context;

  return {
    path,
    method,
    getComponent: context.getComponent,
    getConfigs: context.getConfigs,
    specSelectors: context.specSelectors,
    fn: context.fn,
    contentType: context.producesValue,
    oas3Actions,
    onContentTypeChange: ({ controlsAcceptHeader, value }) => {
      if (controlsAcceptHeader) oas3Actions.setResponseContentType({ value, path, method });
    },
  };
}

function ResponseRow({ context, entry, row }: ResponseRowItemProps): React.ReactElement {
  const [code, response] = entry;
  const { components, specPath, oas3Selectors, path, method } = context;
  const { response: Response } = components;

  return (
    <Response
      {...row.shared}
      code={code}
      response={response}
      className={row.status === code ? 'response_current' : ''}
      isDefault={row.defaultCode === code}
      specPath={specPath.push(code)}
      controlsAcceptHeader={response === row.controlling}
      activeExamplesKey={oas3Selectors.activeExamplesMember(path, method, 'responses', code)}
    />
  );
}

function ResponseRows({ context, entries, rows }: ResponsesTableProps): React.ReactElement {
  const { tryItOutResponse } = context;
  const row: RowState = {
    shared: sharedRowProps(context),
    defaultCode: defaultStatusCode(entries.map(([code]) => code)),
    controlling: acceptControllingResponse(entries),
    status: tryItOutResponse ? String(tryItOutResponse.get('status')) : undefined,
  };

  return (
    <tbody>
      {rows.map(entry => (
        <ResponseRow key={entry[0]} context={context} entry={entry} row={row} />
      ))}
    </tbody>
  );
}

function ResponsesTable(props: ResponsesTableProps): React.ReactElement {
  const { context } = props;
  const regionId: string = htmlReadyId(`${context.method}${context.path}_responses`);

  return (
    <table aria-live="polite" className="responses-table" id={regionId}>
      <thead>
        <tr className="responses-header">
          <th scope="col" className="col_header response-col_status">
            Code
          </th>
          <th scope="col" className="col_header response-col_description">
            Description
          </th>
          <th scope="col" className="col col_header response-col_links">
            Links
          </th>
        </tr>
      </thead>
      <ResponseRows {...props} />
    </table>
  );
}

export default ResponsesTable;
