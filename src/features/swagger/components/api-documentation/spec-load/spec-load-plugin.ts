import { isDuplicateSpec, refFreeSecuritySchemes } from '../../../helpers/spec-load';
import type { RefFreeSubtree } from '../../../types/spec-load';

import type { SpecAction, SpecLoadPlugin, SpecLoadSystem } from './types';

export function skipDuplicateSpec(updateSpec: SpecAction, system: SpecLoadSystem): SpecAction {
  return (...args: unknown[]): unknown =>
    isDuplicateSpec(args[0], system.specSelectors.specStr()) ? undefined : updateSpec(...args);
}

export function storeRefFreeSecuritySchemes(
  requestResolvedSubtree: SpecAction,
  system: SpecLoadSystem
): SpecAction {
  return (...args: unknown[]): unknown => {
    const refFree: RefFreeSubtree | null = refFreeSecuritySchemes(
      args[0],
      system.specSelectors.specJson()
    );

    if (refFree === null) return requestResolvedSubtree(...args);

    return refFree.value == null
      ? undefined
      : system.specActions.updateResolvedSubtree(args[0], refFree.value);
  };
}

export const specLoadPlugin: SpecLoadPlugin = {
  statePlugins: {
    spec: {
      wrapActions: {
        updateSpec: skipDuplicateSpec,
        requestResolvedSubtree: storeRefFreeSecuritySchemes,
      },
    },
  },
};
