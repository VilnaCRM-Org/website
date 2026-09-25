import { swaggerPlugins } from '@swagger/components/api-documentation/plugins';
import {
  skipDuplicateSpec,
  specLoadPlugin,
  storeRefFreeSecuritySchemes,
} from '@swagger/components/api-documentation/spec-load';
import type { SpecLoadSystem } from '@swagger/components/api-documentation/spec-load';

import contract from '../../../../contracts/user-service/openapi.json';

const contractJson: string = JSON.stringify(contract);

function systemFor(specStr: string, updateResolvedSubtree: jest.Mock = jest.fn()): SpecLoadSystem {
  return {
    specSelectors: {
      specStr: () => specStr,
      specJson: () => ({
        getIn: (path: readonly string[]): unknown =>
          path.reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            JSON.parse(specStr)
          ),
      }),
    },
    specActions: { updateResolvedSubtree },
  };
}

describe('integration: swagger spec-load plugin', () => {
  it('is registered in the plugin list ApiDocumentation passes to SwaggerUI', () => {
    expect(swaggerPlugins).toContain(specLoadPlugin);
  });

  it('parses the pinned contract once: the wrapper re-send of the same JSON is dropped', () => {
    const updateSpec = jest.fn();
    const wrapped = skipDuplicateSpec(updateSpec, systemFor(contractJson));

    wrapped(contractJson);
    wrapped(JSON.stringify({ ...contract, info: { ...contract.info, version: 'next' } }));

    expect(updateSpec).toHaveBeenCalledTimes(1);
  });

  it('stores the contract security schemes as resolved and resolves operations as before', () => {
    const request = jest.fn();
    const updateResolvedSubtree = jest.fn();
    const wrapped = storeRefFreeSecuritySchemes(
      request,
      systemFor(contractJson, updateResolvedSubtree)
    );

    wrapped(['components', 'securitySchemes']);
    wrapped(['paths', '/api/users', 'get']);

    expect(updateResolvedSubtree).toHaveBeenCalledWith(
      ['components', 'securitySchemes'],
      contract.components.securitySchemes
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(['paths', '/api/users', 'get']);
  });

  it('still runs the resolver for security schemes that hold a $ref', () => {
    const request = jest.fn();
    const updateResolvedSubtree = jest.fn();
    const spec = { components: { securitySchemes: { A: { $ref: '#/components/x' } } } };
    const wrapped = storeRefFreeSecuritySchemes(
      request,
      systemFor(JSON.stringify(spec), updateResolvedSubtree)
    );

    wrapped(['components', 'securitySchemes']);

    expect(request).toHaveBeenCalledWith(['components', 'securitySchemes']);
    expect(updateResolvedSubtree).not.toHaveBeenCalled();
  });

  it('has nothing to store for a spec that declares no security schemes', () => {
    const request = jest.fn();
    const updateResolvedSubtree = jest.fn();
    const wrapped = storeRefFreeSecuritySchemes(
      request,
      systemFor(JSON.stringify({ openapi: '3.1.0', paths: {} }), updateResolvedSubtree)
    );

    wrapped(['components', 'securitySchemes']);

    expect(request).not.toHaveBeenCalled();
    expect(updateResolvedSubtree).not.toHaveBeenCalled();
  });
});
