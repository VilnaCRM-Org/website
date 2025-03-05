import isHttpError from '../../features/landing/helpers/isHttpError';

type fullError = {
  statusCode: number;
  message: string;
};

describe('isHttpError', () => {
  test('returns true for valid HTTP error', () => {
    const error:fullError= { statusCode: 400, message: 'Bad Request' };
    expect(isHttpError(error)).toBe(true);
  });

  test('returns false for error without statusCode', () => {
    const error: Omit<fullError, 'statusCode'> = { message: 'Some error' };
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
});
