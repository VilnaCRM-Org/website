import fallbackNavigate from '../../../../src/features/landing/helpers/fallbackNavigate';

describe('integration: fallbackNavigate', () => {
  // jsdom 26+ hides Location methods behind an internal implementation symbol;
  // the spyable `assign` lives on that impl object, not on the proxy.
  const getLocationImpl = (): Location => {
    const implSymbol = Reflect.ownKeys(window.location).find(
      (key): key is symbol => typeof key === 'symbol'
    );
    return implSymbol
      ? ((window.location as unknown as Record<symbol, Location>)[implSymbol] ?? window.location)
      : window.location;
  };

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
