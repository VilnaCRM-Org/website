import isHttpError from '../../features/landing/helpers/isHttpError';

type fullError = {
  statusCode: number;
  message: string;
};

describe('isHttpError', () => {
  test('returns true for valid HTTP error', () => {
    const error: fullError = { statusCode: 400, message: 'Bad Request' };
    expect(isHttpError(error)).toBe(true);
  });

  test('returns false for error without statusCode', () => {
    const error: Omit<fullError, 'statusCode'> = { message: 'Some error' };
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for error with non-numeric statusCode', () => {
    const error: unknown = { statusCode: '400', message: 'Bad Request' }; // statusCode as string
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for error with non-string message', () => {
    const error: unknown = { statusCode: 400, message: 123 }; // message as a number
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for error missing message', () => {
    const error: Omit<fullError, 'message'> = { statusCode: 500 }; // missing message
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isHttpError(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isHttpError(undefined)).toBe(false);
  });

  test('returns false for non-object values', () => {
    expect(isHttpError('error')).toBe(false);
    expect(isHttpError(500)).toBe(false);
    expect(isHttpError([])).toBe(false);
  });

  test('returns false for objects missing both statusCode and message', () => {
    const error: unknown = { foo: 'bar' };
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for object with extra properties but wrong statusCode type', () => {
    const error: unknown = { statusCode: null, message: 'Bad Request', extra: 'info' };
    expect(isHttpError(error)).toBe(false);
  });

  test('returns false for object with extra properties but wrong message type', () => {
    const error: unknown = { statusCode: 500, message: true, extra: 'info' };
    expect(isHttpError(error)).toBe(false);
  });
});
