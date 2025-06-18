export const networkMessage: string = 'Failed to fetch';
export const NETWORK_FAILURE: Error = new Error(networkMessage);

export class ServerError extends Error {
  public statusCode: number = 500;

  constructor(message = 'Network error') {
    super(message);
    this.name = 'ServerError';
  }
}
