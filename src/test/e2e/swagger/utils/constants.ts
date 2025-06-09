export const testUserId: string = 'test-user-id';

export const testConfirmationToken: string = 'test-confirmation-token';

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

type UserData = {
  email: string;
  password: string;
  initials: string;
  clientMutationId: string;
};

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

export const testUserData: UserData = {
  email: 'test@example.com',
  password: TEST_PASSWORDS.STRONG,
  initials: 'TE',
  clientMutationId: 'test-mutation-1',
};

export const updatedUserData: UserData = {
  email: 'another@example.com',
  password: TEST_PASSWORDS.SPECIAL_CHARS,
  initials: 'AN',
  clientMutationId: 'test-mutation-2',
};

export interface User {
  email: string;
  password: string;
  initials: string;
}
export interface BatchUserData {
  users: User[];
}

export const batchUserData: BatchUserData = {
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
