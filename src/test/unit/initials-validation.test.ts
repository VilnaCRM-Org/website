import { faker } from '@faker-js/faker';

import { validateFullName } from '../../features/landing/components/AuthSection/Validations';

const fullNameRequiredError: string = 'Invalid full name format';

const testFullName: string = faker.person.fullName();

describe('validateFullName', () => {
  it('should return true when a valid full name is provided', () => {
    const result: string | boolean = validateFullName(testFullName);
    expect(result).toBe(true);
  });

  it('should return an error message when full name is empty', () => {
    const result: string | boolean = validateFullName('');
    expect(result).toBe(fullNameRequiredError);
  });
});