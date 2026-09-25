import type { ComponentType } from 'react';

import { swaggerPlugins } from '@swagger/components/api-documentation/plugins';
import type { SwaggerSystem } from '@swagger/components/api-documentation/responses-table';

type Wrapper<P> = (Original: ComponentType<P>, system: SwaggerSystem) => ComponentType<P>;

export function applySwaggerPlugins<P>(
  name: string,
  Original: ComponentType<P>,
  system: SwaggerSystem
): ComponentType<P> {
  return swaggerPlugins.reduce<ComponentType<P>>((Component, plugin) => {
    const wrappers: Record<string, unknown> = plugin.wrapComponents;
    const wrap = wrappers[name] as Wrapper<P> | undefined;

    return wrap ? wrap(Component, system) : Component;
  }, Original);
}
