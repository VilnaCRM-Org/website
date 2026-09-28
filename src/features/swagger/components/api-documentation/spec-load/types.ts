import type { SpecJson } from '../../../types/spec-load';

export interface SpecLoadSystem {
  specSelectors: {
    specStr: () => unknown;
    specJson: () => SpecJson;
  };
  specActions: {
    updateResolvedSubtree: (path: unknown, value: unknown) => unknown;
  };
}

export type SpecAction = (...args: unknown[]) => unknown;

export type SpecActionWrapper = (action: SpecAction, system: SpecLoadSystem) => SpecAction;

export interface SpecLoadPlugin {
  statePlugins: {
    spec: {
      wrapActions: {
        updateSpec: SpecActionWrapper;
        requestResolvedSubtree: SpecActionWrapper;
      };
    };
  };
}
