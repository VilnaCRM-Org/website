import { errorMessages } from './constants';

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': '*',
};

export type RouteLike = {
  request: () => {
    method: () => string;
  };
  fulfill: (response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  }) => Promise<void>;
  abort: (errorCode: 'failed') => Promise<void>;
  continue: () => Promise<void>;
};

export const browserSpecificFailureMarkers: readonly string[] = [
  'Possible Reasons',
  'Network Failure',
  'TypeError',
  'Undocumented',
];

export async function fulfillPreflight(route: RouteLike): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') {
    return false;
  }

  await route.fulfill({
    status: 204,
    headers: CORS_HEADERS,
    body: '',
  });

  return true;
}

export function createNetworkFailureRouteHandler(options?: {
  times?: number;
}): (route: RouteLike) => Promise<void> {
  let remaining: number = options?.times ?? 1;

  return async (route: RouteLike): Promise<void> => {
    if (await fulfillPreflight(route)) {
      return;
    }

    if (remaining <= 0) {
      await route.continue();
      return;
    }

    remaining -= 1;
    await route.abort('failed');
  };
}

export function isNonSuccessStatus(statusText: string | null | undefined): boolean {
  const normalizedStatus: string = statusText?.trim() ?? '';

  if (normalizedStatus.length === 0) {
    return false;
  }

  const statusCodeMatch: RegExpMatchArray | null = normalizedStatus.match(/\b(\d{3})\b/);
  if (statusCodeMatch) {
    const statusCode: number = Number(statusCodeMatch[1]);
    return statusCode < 200 || statusCode >= 300;
  }

  return /\b(error|failed|failure|undocumented)\b/i.test(normalizedStatus);
}

export function isExpectedFailureState(
  combinedErrorText: string,
  statusText: string | null | undefined
): boolean {
  const hasErrorMessage: boolean = [
    ...Object.values(errorMessages),
    ...browserSpecificFailureMarkers,
  ].some(msg => combinedErrorText.includes(msg));

  return hasErrorMessage || isNonSuccessStatus(statusText);
}
