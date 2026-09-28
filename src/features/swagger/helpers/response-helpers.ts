import type { ResponseDefinition, ResponseEntry } from '../types/responses';

const DEFAULT_RESPONSE_CODE = 'default';

function isSuccessCode(code: string): boolean {
  return code.startsWith('2');
}

function hasMediaTypes(response: ResponseDefinition | undefined): response is ResponseDefinition {
  return (response?.get('content')?.size ?? 0) > 0;
}

export function isExtension(key: string): boolean {
  return /^x-/.test(key);
}

export function htmlReadyId(id: string): string {
  return id.replace(/[^\w-]/g, '_');
}

export function defaultStatusCode(codes: readonly string[]): string | undefined {
  if (codes.includes(DEFAULT_RESPONSE_CODE)) {
    return DEFAULT_RESPONSE_CODE;
  }

  return codes.filter(isSuccessCode).sort()[0];
}

export function acceptControllingResponse(
  entries: readonly ResponseEntry[]
): ResponseDefinition | null {
  const success: ResponseEntry | undefined = entries.find(
    ([code, response]) => isSuccessCode(code) && Boolean(response.get('content'))
  );

  if (success) {
    return success[1];
  }

  const fallback: ResponseDefinition | undefined = entries.find(
    ([code]) => code === DEFAULT_RESPONSE_CODE
  )?.[1];

  return hasMediaTypes(fallback) ? fallback : null;
}
