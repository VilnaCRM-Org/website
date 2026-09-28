import React, { ComponentType } from 'react';

import OwnedResponses from './owned-responses';
import {
  OwnedResponsesProps,
  ResponsesComponents,
  ResponsesProps,
  ResponsesTablePlugin,
  SwaggerSystem,
} from './types';

export function withOwnedResponses(
  Original: ComponentType<ResponsesProps>,
  system: SwaggerSystem
): ComponentType<ResponsesProps> {
  const Owned: ComponentType<OwnedResponsesProps> = system.fn.withErrorBoundary(OwnedResponses);
  const components: ResponsesComponents = {
    liveResponse: system.getComponent('liveResponse'),
    response: system.getComponent('response'),
  };

  function VersionedResponses(props: ResponsesProps): React.ReactElement {
    const { specSelectors } = props;

    return specSelectors.isOAS3() ? (
      <Owned {...props} components={components} />
    ) : (
      <Original {...props} />
    );
  }

  return VersionedResponses;
}

export const responsesTablePlugin: ResponsesTablePlugin = {
  wrapComponents: {
    responses: withOwnedResponses,
  },
};
