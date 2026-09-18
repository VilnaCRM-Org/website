/**
 * @jest-environment jsdom
 */
/**
 * Client-layer coverage for the landing `fallbackNavigate` helper.
 *
 * The helper was asserted only by the integration layer
 * (`tests/integration/coverage/landing-helpers`), which the mutation runner does
 * not execute; the one client spec that imports it (`Header.test.tsx`) mocks it
 * away, so Stryker found a "related" test that killed nothing and reported the
 * body as removable. This is the same contract in the layer Stryker runs.
 *
 * jsdom is declared per file because `src/test/unit` also runs under the node
 * (server) layer, where there is no `window`.
 *
 * Boundary / edge — Not applicable: one-line delegation with no branch.
 * Loading / error — Not applicable: synchronous, no async boundary.
 * Permission / auth — Not applicable.
 */
import fallbackNavigate from '../../features/landing/helpers/fallbackNavigate';

// jsdom 26+ hides Location methods behind an internal implementation symbol;
// the spyable `assign` lives on that impl object, not on the proxy.
const getLocationImpl = (): Location => {
  const implSymbol: symbol | undefined = Reflect.ownKeys(window.location).find(
    (key): key is symbol => typeof key === 'symbol'
  );
  return implSymbol
    ? ((window.location as unknown as Record<symbol, Location>)[implSymbol] ?? window.location)
    : window.location;
};

describe('fallbackNavigate', () => {
  let assignSpy: jest.SpyInstance;

  beforeEach(() => {
    assignSpy = jest.spyOn(getLocationImpl(), 'assign').mockImplementation(() => {});
  });

  afterEach(() => {
    assignSpy.mockRestore();
  });

  it('delegates to window.location.assign with the given url', () => {
    fallbackNavigate('/contacts');

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/contacts');
  });

  it('passes anchor links through unchanged', () => {
    fallbackNavigate('#signUp');

    expect(assignSpy).toHaveBeenCalledWith('#signUp');
  });
});
