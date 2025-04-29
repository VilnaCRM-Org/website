import { validateFormInput } from '../testing-library/utils';

describe('validateFormInput', () => {
  it('should throw an error if the full name is too short', () => {
    expect(() => validateFormInput('J', 'test@example.com', 'password123')).toThrow(
      'Full name must be at least 2 characters'
    );
  });

  it('should throw an error if the email format is invalid', () => {
    expect(() => validateFormInput('John Doe', 'invalid-email', 'password123')).toThrow(
      'Invalid email format'
    );
  });

  it('should throw an error if the password is too short', () => {
    expect(() => validateFormInput('John Doe', 'test@example.com', 'short')).toThrow(
      'Password must be at least 8 characters'
    );
  });

  it('should not throw an error for valid inputs', () => {
    expect(() =>
      validateFormInput('John Doe', 'test@example.com', 'validpassword123')
    ).not.toThrow();
  });
});
