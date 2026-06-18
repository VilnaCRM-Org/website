/**
 * Integration coverage for the swagger feature's `fetchSwaggerYaml` helper.
 *
 * The helper wraps the global Fetch API (provided here by the jsdom-fetch
 * environment) and normalises every failure mode into a descriptive `Error`.
 * Each branch is exercised: success, non-empty whitespace guard, the `!ok`
 * guard, the empty-body guard, an `Error` thrown mid-flight, and a non-`Error`
 * rejection that hits the final fallback.
 */
import fetchSwaggerYaml from '../../../../src/features/swagger/api/fetchSwaggerYaml';

const URL = 'https://swagger.integration.test/spec.yaml';

describe('integration: fetchSwaggerYaml', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('returns the response body when the request succeeds', async () => {
    const body = 'openapi: "3.0.0"';
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));

    await expect(fetchSwaggerYaml(URL)).resolves.toBe(body);
    expect(fetchSpy).toHaveBeenCalledWith(URL);
  });

  it('throws a descriptive error when the response is not ok', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }));

    await expect(fetchSwaggerYaml(URL)).rejects.toThrow(
      'Error fetching Swagger YAML: Failed to fetch Swagger YAML: 404 Not Found'
    );
  });

  it('throws when the response body is empty/whitespace', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('   ', { status: 200 }));

    await expect(fetchSwaggerYaml(URL)).rejects.toThrow(
      'Error fetching Swagger YAML: Received empty response from Swagger YAML endpoint'
    );
  });

  it('wraps a thrown Error with the fetching-context message', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(fetchSwaggerYaml(URL)).rejects.toThrow(
      'Error fetching Swagger YAML: network down'
    );
  });

  it('falls back to the unknown-error message for non-Error rejections', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue('boom');

    await expect(fetchSwaggerYaml(URL)).rejects.toThrow(
      'Unknown error occurred while fetching Swagger YAML'
    );
  });
});
