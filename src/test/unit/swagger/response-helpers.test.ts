import {
  acceptControllingResponse,
  defaultStatusCode,
  htmlReadyId,
  isExtension,
} from '../../../features/swagger/helpers/response-helpers';
import type { ResponseDefinition, ResponseEntry } from '../../../features/swagger/types/responses';

function definition(body?: { size: number } | null): ResponseDefinition {
  return { get: () => body };
}

const withContent: ResponseDefinition = definition({ size: 1 });
const withEmptyContent: ResponseDefinition = definition({ size: 0 });
const withoutContent: ResponseDefinition = definition(undefined);

describe('isExtension', () => {
  it.each(['x-rate-limit', 'x-'])('treats %p as a vendor extension', key => {
    expect(isExtension(key)).toBe(true);
  });

  it.each(['200', 'default', 'ax-b', 'X-upper', ''])('treats %p as a response code', key => {
    expect(isExtension(key)).toBe(false);
  });
});

describe('htmlReadyId', () => {
  it('turns the method and path into the id swagger-ui renders', () => {
    expect(htmlReadyId('get/api/users_responses')).toBe('get_api_users_responses');
  });

  it('replaces every invalid character and keeps word characters and hyphens', () => {
    expect(htmlReadyId('patch/api/users/{id}.json_responses')).toBe(
      'patch_api_users__id__json_responses'
    );
    expect(htmlReadyId('delete/api/user-groups')).toBe('delete_api_user-groups');
  });
});

describe('defaultStatusCode', () => {
  it('prefers the default response when one is declared', () => {
    expect(defaultStatusCode(['200', 'default', '400'])).toBe('default');
  });

  it('otherwise picks the lowest 2xx code', () => {
    expect(defaultStatusCode(['204', '200', '201'])).toBe('200');
  });

  it('ignores codes outside 2xx even when they sort first', () => {
    expect(defaultStatusCode(['100', '404', '201'])).toBe('201');
  });

  it.each<[string, string[]]>([
    ['no 2xx code', ['400', '500']],
    ['no codes', []],
  ])('has no default with %s', (_case, codes) => {
    expect(defaultStatusCode(codes)).toBeUndefined();
  });
});

describe('acceptControllingResponse', () => {
  it('picks the first 2xx response that declares content', () => {
    const entries: ResponseEntry[] = [
      ['200', withoutContent],
      ['201', withContent],
      ['default', withContent],
    ];

    expect(acceptControllingResponse(entries)).toBe(withContent);
    expect(acceptControllingResponse(entries)).toBe(entries[1]![1]);
  });

  it('counts a declared but empty content map as content, like upstream', () => {
    const entries: ResponseEntry[] = [
      ['200', withEmptyContent],
      ['default', withContent],
    ];

    expect(acceptControllingResponse(entries)).toBe(withEmptyContent);
  });

  it('ignores non-2xx responses with content', () => {
    expect(acceptControllingResponse([['400', withContent]])).toBeNull();
  });

  it('falls back to a default response that has media types', () => {
    const fallback: ResponseDefinition = definition({ size: 2 });

    expect(
      acceptControllingResponse([
        ['200', withoutContent],
        ['default', fallback],
      ])
    ).toBe(fallback);
  });

  it.each<[string, ResponseEntry[]]>([
    ['a default with an empty content map', [['default', withEmptyContent]]],
    ['a default without content', [['default', withoutContent]]],
    ['a default with null content', [['default', definition(null)]]],
    ['no default at all', [['204', withoutContent]]],
    ['no responses', []],
  ])('returns null for %s', (_case, entries) => {
    expect(acceptControllingResponse(entries)).toBeNull();
  });
});
