import type { Locator } from '@playwright/test';

export const testUserId: string = 'test-user-id';

export const confirmationToken: string = 'test-confirmation-token';

export const userInitials: string = 'PA';

type OAuthData = { GRANT_TYPE: string; CLIENT_ID: string; CODE: string };
export const TEST_OAUTH_DATA: OAuthData = {
  GRANT_TYPE: 'new_authorization_code',
  CLIENT_ID: 'new_client_id_123',
  CODE: 'new_code_456',
} as const;

export const executeBtnSelector: string =
  '[data-testid="execute-btn"], .btn.execute.opblock-control__btn, .execute';

export const UI_INTERACTION_DELAY: number = 100;

type TestsPasswords = {
  STRONG: string;
  WEAK: string;
  SPECIAL_CHARS: string;
};
export const TEST_PASSWORDS: TestsPasswords = {
  STRONG: 'TestPassword123!@#',
  WEAK: '123456',
  SPECIAL_CHARS: 'Test@Pass#123',
} as const;

export interface User {
  email: string;
  password: string;
  initials: string;
}
export interface BatchUserData {
  users: User[];
}
export interface ApiUser {
  confirmed: boolean;
  email: string;
  initials: string;
  id: string;
}
export const validBatchData: BatchUserData = {
  users: [
    {
      email: 'test1@example.com',
      password: TEST_PASSWORDS.STRONG,
      initials: 'T1',
    },
    {
      email: 'test2@example.com',
      password: TEST_PASSWORDS.SPECIAL_CHARS,
      initials: 'T2',
    },
  ],
};

type OAuthParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
};
export const testOAuthParams: OAuthParams = {
  responseType: 'code',
  clientId: 'test-client',
  redirectUri: 'http://localhost:3000/callback',
} as const;

export interface BasicEndpointElements {
  getEndpoint: Locator;
  executeBtn: Locator;
  requestUrl: Locator;
  responseBody: Locator;
}
export const TEST_USERS: Record<string, User> = {
  VALID: {
    email: 'user@example.com',
    initials: 'Name Surname',
    password: TEST_PASSWORDS.STRONG,
  },
  INVALID_EMAIL: {
    email: 'invalid-email',
    initials: 'Test User',
    password: TEST_PASSWORDS.STRONG,
  },
  WEAK_PASSWORD: {
    email: 'user@example.com',
    initials: 'Test User',
    password: TEST_PASSWORDS.WEAK,
  },
} as const;

export const errorResponse: { NETWORK: string; LOAD: string; FETCH: string } = {
  NETWORK: 'TypeError: NetworkError when attempting to fetch resource.',
  LOAD: 'TypeError: Load failed',
  FETCH: 'Failed to fetch',
};
export type ExpectedError = RegExpMatchArray | null | undefined;
export const BASE_API: string = '**/api/users';
