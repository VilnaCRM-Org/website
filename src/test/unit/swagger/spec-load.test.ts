import {
  skipDuplicateSpec,
  specLoadPlugin,
  storeRefFreeSecuritySchemes,
} from '../../../features/swagger/components/api-documentation/spec-load';
import {
  isDuplicateSpec,
  refFreeSecuritySchemes,
} from '../../../features/swagger/helpers/spec-load';

type SpecLoadSystem = Parameters<typeof skipDuplicateSpec>[1];

const SCHEMES_PATH: string[] = ['components', 'securitySchemes'];

const OAUTH2_SCHEMES = {
  OAuth2: {
    type: 'oauth2',
    flows: { authorizationCode: { authorizationUrl: 'https://a/b', tokenUrl: 'https://a/c' } },
  },
};

function specJsonWith(securitySchemes: unknown): { getIn: jest.Mock } {
  return {
    getIn: jest.fn((path: readonly string[]) =>
      path.join('.') === 'components.securitySchemes' ? securitySchemes : undefined
    ),
  };
}

function systemWith(
  specStr: unknown,
  securitySchemes: unknown = OAUTH2_SCHEMES
): SpecLoadSystem & { specActions: { updateResolvedSubtree: jest.Mock } } {
  return {
    specSelectors: {
      specStr: () => specStr,
      specJson: () => specJsonWith(securitySchemes),
    },
    specActions: { updateResolvedSubtree: jest.fn(() => 'stored') },
  };
}

describe('spec-load helpers', () => {
  it('treats only an identical spec string as a duplicate', () => {
    expect(isDuplicateSpec('{"a":1}', '{"a":1}')).toBe(true);
    expect(isDuplicateSpec('{"a":1}', '{"a":2}')).toBe(false);
    expect(isDuplicateSpec('{"a":1}', '')).toBe(false);
    expect(isDuplicateSpec(undefined, undefined)).toBe(false);
    const spec = { a: 1 };
    expect(isDuplicateSpec(spec, spec)).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a parent path', ['components']],
    ['a child path', ['components', 'securitySchemes', 'OAuth2']],
    ['a sibling path', ['components', 'schemas']],
    ['another root', ['paths', 'securitySchemes']],
    ['a dotted string', 'components.securitySchemes'],
    ['no path', undefined],
  ])('leaves %s to the resolver', (_case, path) => {
    expect(refFreeSecuritySchemes(path, specJsonWith(OAUTH2_SCHEMES))).toBeNull();
  });

  it.each<[string, unknown]>([
    ['a $ref', { A: { $ref: '#/components/securitySchemes/B' } }],
    ['an OpenID Connect scheme', { A: { type: 'openIdConnect', openIdConnectUrl: 'https://a' } }],
  ])('leaves security schemes holding %s to the resolver', (_case, securitySchemes) => {
    expect(refFreeSecuritySchemes(SCHEMES_PATH, specJsonWith(securitySchemes))).toBeNull();
  });

  it.each<[string, unknown]>([
    ['ref-free OAuth2 schemes', OAUTH2_SCHEMES],
    ['no schemes at all', undefined],
    ['a null schemes node', null],
  ])('returns %s as their own resolved form', (_case, securitySchemes) => {
    const specJson = specJsonWith(securitySchemes);

    expect(refFreeSecuritySchemes(SCHEMES_PATH, specJson)).toEqual({ value: securitySchemes });
    expect(specJson.getIn).toHaveBeenCalledWith(SCHEMES_PATH);
  });
});

describe('specLoadPlugin', () => {
  it('registers both wrappers under the spec actions swagger-ui dispatches', () => {
    expect(specLoadPlugin.statePlugins.spec.wrapActions).toEqual({
      updateSpec: skipDuplicateSpec,
      requestResolvedSubtree: storeRefFreeSecuritySchemes,
    });
  });

  it('drops an updateSpec that re-sends the spec already in the store', () => {
    const updateSpec = jest.fn(() => 'dispatched');
    const wrapped = skipDuplicateSpec(updateSpec, systemWith('{"openapi":"3.1.0"}'));

    expect(wrapped('{"openapi":"3.1.0"}')).toBeUndefined();
    expect(updateSpec).not.toHaveBeenCalled();
  });

  it('forwards a new spec with every argument and returns the original result', () => {
    const updateSpec = jest.fn(() => 'dispatched');
    const wrapped = skipDuplicateSpec(updateSpec, systemWith(''));

    expect(wrapped('{"openapi":"3.1.0"}', 'extra')).toBe('dispatched');
    expect(updateSpec).toHaveBeenCalledWith('{"openapi":"3.1.0"}', 'extra');
  });

  it('stores ref-free security schemes as resolved instead of running the resolver', () => {
    const request = jest.fn(() => 'requested');
    const system = systemWith('', OAUTH2_SCHEMES);

    expect(storeRefFreeSecuritySchemes(request, system)(SCHEMES_PATH)).toBe('stored');
    expect(request).not.toHaveBeenCalled();
    expect(system.specActions.updateResolvedSubtree).toHaveBeenCalledWith(
      SCHEMES_PATH,
      OAUTH2_SCHEMES
    );
  });

  it('stores nothing when the security schemes node is empty', () => {
    const request = jest.fn(() => 'requested');
    const system = systemWith('', null);

    expect(storeRefFreeSecuritySchemes(request, system)(SCHEMES_PATH)).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(system.specActions.updateResolvedSubtree).not.toHaveBeenCalled();
  });

  it.each<[string, unknown[], unknown]>([
    ['an operation path', ['paths', '/api/users', 'get'], OAUTH2_SCHEMES],
    ['security schemes holding a $ref', SCHEMES_PATH, { A: { $ref: '#/x' } }],
    [
      'an OpenID Connect scheme',
      SCHEMES_PATH,
      { A: { type: 'openIdConnect', openIdConnectUrl: 'https://a' } },
    ],
  ])('still resolves %s', (_case, path, securitySchemes) => {
    const request = jest.fn(() => 'requested');
    const system = systemWith('', securitySchemes);

    expect(storeRefFreeSecuritySchemes(request, system)(path, 'extra')).toBe('requested');
    expect(request).toHaveBeenCalledWith(path, 'extra');
    expect(system.specActions.updateResolvedSubtree).not.toHaveBeenCalled();
  });
});
