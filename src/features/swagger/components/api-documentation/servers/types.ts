import type { ComponentType } from 'react';

export interface ServersContainerProps {
  specSelectors: {
    servers: () => { size: number } | null | undefined;
  };
}

export type ServersContainerWrapper = (
  Original: ComponentType<ServersContainerProps>
) => ComponentType<ServersContainerProps>;

export interface ServersLabelPlugin {
  wrapComponents: {
    ServersContainer: ServersContainerWrapper;
  };
}
