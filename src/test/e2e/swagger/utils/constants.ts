export const testUserId: string = 'test-user-id';

export const testConfirmationToken: string = 'test-confirmation-token';

export const userInitials: string = 'PA';

type OAuthData = { GRANT_TYPE: string; CLIENT_ID: string; CODE: string };
export const TEST_OAUTH_DATA: OAuthData = {
  GRANT_TYPE: 'new_authorization_code',
  CLIENT_ID: 'new_client_id_123',
  CODE: 'new_code_456',
} as const;
