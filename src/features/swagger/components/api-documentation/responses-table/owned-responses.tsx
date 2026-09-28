import React from 'react';

import { isExtension } from '../../../helpers/response-helpers';
import type { ResponseEntry } from '../../../types/responses';

import ResponsesTable from './responses-table';
import { LiveResponseSectionProps, OwnedResponsesProps } from './types';

function LiveResponseSection({
  context,
  LiveResponse,
  response,
  displayRequestDuration,
}: LiveResponseSectionProps): React.ReactElement | null {
  if (!response) {
    return null;
  }

  return (
    <div>
      <LiveResponse
        response={response}
        getComponent={context.getComponent}
        getConfigs={context.getConfigs}
        specSelectors={context.specSelectors}
        path={context.path}
        method={context.method}
        displayRequestDuration={displayRequestDuration}
      />
      <h4>Responses</h4>
    </div>
  );
}

function OwnedResponses(props: OwnedResponsesProps): React.ReactElement | null {
  const { responses, tryItOutResponse, displayRequestDuration = false, components } = props;
  const entries: ResponseEntry[] = responses.entrySeq().toArray();
  const rows: ResponseEntry[] = entries.filter(([code]) => !isExtension(code));

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="responses-wrapper">
      <div className="opblock-section-header">
        <h4>Responses</h4>
      </div>
      <div className="responses-inner">
        <LiveResponseSection
          context={props}
          LiveResponse={components.liveResponse}
          response={tryItOutResponse}
          displayRequestDuration={displayRequestDuration}
        />
        <ResponsesTable context={props} entries={entries} rows={rows} />
      </div>
    </div>
  );
}

export default OwnedResponses;
