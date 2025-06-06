export const testUserId: string = 'test-user-id';

export const testConfirmationToken: string = 'test-confirmation-token';

export const userInitials: string = 'PA';

type OAuthData = { GRANT_TYPE: string; CLIENT_ID: string; CODE: string };
export const TEST_OAUTH_DATA: OAuthData = {
  GRANT_TYPE: 'new_authorization_code',
  CLIENT_ID: 'new_client_id_123',
  CODE: 'new_code_456',
} as const;

export const executeBtnSelector: string = '.btn.execute.opblock-control__btn';

export const UI_INTERACTION_DELAY: number = 100;

type UserData = {
  email: string;
  password: string;
  initials: string;
  clientMutationId: string;
};
export const testUserData: UserData = {
  email: 'test@example.com',
  password: 'TestPassword123',
  initials: 'TE',
  clientMutationId: 'test-mutation-1',
};

export const updatedUserData: UserData = {
  email: 'another@example.com',
  password: 'AnotherPass456',
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
      password: 'TestPassword123',
      initials: 'T1',
    },
    {
      email: 'test2@example.com',
      password: 'TestPassword456',
      initials: 'T2',
    },
  ],
};

export const testOAuthParams: {
  responseType: string;
  clientId: string;
  redirectUri: string;
} = {
  responseType: 'code',
  clientId: 'test-client',
  redirectUri: 'http://localhost:3000/callback',
};
