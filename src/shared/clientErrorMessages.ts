import { t } from 'i18next';

export type ClientErrorKeys = {
  readonly NETWORK: 'network';
  readonly UNAUTHORIZED: 'unauthorized';
  readonly DENIED: 'denied';
  readonly UNEXPECTED: 'unexpected';
  readonly WENT_WRONG: 'went_wrong';
  readonly SERVER_ERROR: 'server_error';
};
export const CLIENT_ERROR_KEYS: ClientErrorKeys = {
  NETWORK: 'network',
  UNAUTHORIZED: 'unauthorized',
  DENIED: 'denied',
  UNEXPECTED: 'unexpected',
  WENT_WRONG: 'went_wrong',
  SERVER_ERROR: 'server_error',
} as const;

export type ClientErrorKey = (typeof CLIENT_ERROR_KEYS)[keyof typeof CLIENT_ERROR_KEYS];

export type ClientErrorMessages = Record<ClientErrorKey, string>;
export type GetClientsErrorMessages = () => ClientErrorMessages;

export const getClientErrorMessages: GetClientsErrorMessages = () => ({
  [CLIENT_ERROR_KEYS.UNAUTHORIZED]: t(
    'failure_responses.authentication_errors.unauthorized_access'
  ),
  [CLIENT_ERROR_KEYS.DENIED]: t('failure_responses.authentication_errors.access_denied'),
  [CLIENT_ERROR_KEYS.WENT_WRONG]: t('failure_responses.client_errors.something_went_wrong'),
  [CLIENT_ERROR_KEYS.UNEXPECTED]: t('failure_responses.client_errors.unexpected_error'),
  [CLIENT_ERROR_KEYS.NETWORK]: t('failure_responses.network_errors.network_error'),
  [CLIENT_ERROR_KEYS.SERVER_ERROR]: t('failure_responses.server_errors.server_error'),
});
