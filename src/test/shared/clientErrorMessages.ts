import { t } from 'i18next';

type clientErrorKeys =
  | 'network'
  | 'unauthorized'
  | 'denied'
  | 'unexpected'
  | 'went_wrong'
  | 'server_error';

export const clientErrorMessages: Record<clientErrorKeys, string> = {
  unauthorized: t('failure_responses.authentication_errors.unauthorized_access'),
  denied: t('failure_responses.authentication_errors.access_denied'),

  went_wrong: t('failure_responses.client_errors.something_went_wrong'),
  unexpected: t('failure_responses.client_errors.unexpected_error'),

  network: t('failure_responses.network_errors.network_error'),
  server_error: t('failure_responses.server_errors.server_error'),
};

export enum HTTPStatusCodes {
  SERVER_ERROR = 500,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
}
