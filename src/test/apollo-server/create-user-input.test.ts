import { GraphQLError } from 'graphql';

import type { CreateUserInput } from '../../../docker/apollo-server/type';
import {
  CREATE_USER_ALLOWED_PROPERTIES,
  CREATE_USER_REASONS,
  assertOnlyAllowedProperties,
  buildNewUser,
  normalizeEmail,
  validateCreateUserInput,
} from '../../../docker/apollo-server/user-input';

/**
 * Issue #381 / F1 — unit level.
 *
 * Scenario classes (agents.md step 2):
 *   * positive — a valid input yields a server-generated id and an unconfirmed user;
 *   * negative — mass assignment, malformed email/initials, missing password;
 *   * boundary — initials at and below the minimum, empty strings, empty input object.
 *
 * Permission / auth — Not applicable: the mock has no authenticated state; the
 * authorization-adjacent property (`confirmed`) is asserted here as a value default.
 * Locale / responsive / a11y — Not applicable: server-side input validation renders
 * no UI and emits no localized copy.
 */

const validInput: CreateUserInput = {
  email: 'valid.user@example.com',
  initials: 'VU',
  password: 'Strong-Password-123',
  clientMutationId: 'client-supplied-id',
};

function reasonOf(run: () => void): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as GraphQLError).extensions?.reason as string | undefined;
  }
  return undefined;
}

describe('createUser input handling (mock reference pattern)', () => {
  describe('buildNewUser — server-owned identity', () => {
    it('generates the primary key server-side and never from clientMutationId', () => {
      const user = buildNewUser(validInput);

      expect(user.id).not.toBe(validInput.clientMutationId);
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('issues a distinct id for every call, even for identical input', () => {
      expect(buildNewUser(validInput).id).not.toBe(buildNewUser(validInput).id);
    });

    it('defaults confirmed to false so a signup cannot self-verify its email', () => {
      expect(buildNewUser(validInput).confirmed).toBe(false);
    });

    it('copies only the two client-owned profile fields onto the record', () => {
      expect(buildNewUser(validInput)).toEqual({
        id: expect.any(String),
        confirmed: false,
        email: validInput.email,
        initials: validInput.initials,
      });
    });

    it('never stores or echoes the password', () => {
      expect(Object.keys(buildNewUser(validInput))).not.toContain('password');
    });
  });

  describe('assertOnlyAllowedProperties — mass assignment', () => {
    it('accepts exactly the properties the pinned schema declares', () => {
      expect(CREATE_USER_ALLOWED_PROPERTIES).toEqual([
        'email',
        'initials',
        'password',
        'clientMutationId',
      ]);
      expect(() => assertOnlyAllowedProperties({ ...validInput })).not.toThrow();
    });

    it('rejects a smuggled primary key', () => {
      expect(() => assertOnlyAllowedProperties({ ...validInput, id: 'existing-user-id' })).toThrow(
        'Unknown input property: id'
      );
    });

    it('rejects a smuggled confirmation flag', () => {
      expect(() => assertOnlyAllowedProperties({ ...validInput, confirmed: true })).toThrow(
        'Unknown input property: confirmed'
      );
    });

    it('reports every unknown property, sorted, and tags a stable reason', () => {
      const run = (): void =>
        assertOnlyAllowedProperties({ ...validInput, role: 'admin', confirmed: true, id: 'x' });

      expect(run).toThrow('Unknown input properties: confirmed, id, role');
      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.UNKNOWN_INPUT_PROPERTY);
    });

    it('accepts an empty object (there is nothing to mass-assign)', () => {
      expect(() => assertOnlyAllowedProperties({})).not.toThrow();
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an array', ['email']],
      ['a string', 'email'],
      ['a number', 7],
    ])('rejects %s with a stable reason rather than a TypeError', (_label, input) => {
      const run = (): void => assertOnlyAllowedProperties(input);

      expect(run).toThrow('Input must be an object');
      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.INVALID_INPUT_TYPE);
    });
  });

  describe('normalizeEmail — the identity key', () => {
    it.each([
      ['User@Example.com', 'user@example.com'],
      ['  user@example.com  ', 'user@example.com'],
      ['USER@EXAMPLE.COM', 'user@example.com'],
    ])('canonicalises %s', (raw, expected) => {
      expect(normalizeEmail(raw)).toBe(expected);
    });

    it('stores the canonical form, so case variants cannot become two accounts', () => {
      expect(buildNewUser({ ...validInput, email: 'User@Example.com' }).email).toBe(
        'user@example.com'
      );
    });
  });

  describe('validateCreateUserInput', () => {
    it('accepts a valid input', () => {
      expect(() => validateCreateUserInput(validInput)).not.toThrow();
    });

    it('accepts an input without the optional clientMutationId', () => {
      const { clientMutationId, ...withoutEcho } = validInput;

      expect(clientMutationId).toBeDefined();
      expect(() => validateCreateUserInput(withoutEcho as CreateUserInput)).not.toThrow();
    });

    it.each([
      ['a malformed address', 'not-an-email'],
      ['an empty address', ''],
      ['an address with whitespace', 'user name@example.com'],
      ['an address with no domain dot', 'user@example'],
    ])('rejects %s', (_label, email) => {
      const run = (): void => validateCreateUserInput({ ...validInput, email });

      expect(run).toThrow('Invalid email format');
      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.INVALID_EMAIL);
    });

    it('rejects initials shorter than the two-character minimum', () => {
      const run = (): void => validateCreateUserInput({ ...validInput, initials: 'V' });

      expect(run).toThrow('Invalid initials');
      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.INVALID_INITIALS);
    });

    it('accepts initials exactly at the minimum length', () => {
      expect(() => validateCreateUserInput({ ...validInput, initials: 'VU' })).not.toThrow();
    });

    it('rejects empty initials', () => {
      expect(() => validateCreateUserInput({ ...validInput, initials: '' })).toThrow(
        'Invalid initials'
      );
    });

    it('rejects a missing password so no passwordless account can be created', () => {
      const run = (): void => validateCreateUserInput({ ...validInput, password: '' });

      expect(run).toThrow('Password is required');
      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.MISSING_PASSWORD);
    });

    it('rejects mass assignment before it validates anything else', () => {
      const run = (): void =>
        validateCreateUserInput({ ...validInput, email: 'bad', id: 'x' } as CreateUserInput);

      expect(reasonOf(run)).toBe(CREATE_USER_REASONS.UNKNOWN_INPUT_PROPERTY);
    });

    it('raises a 400 GraphQLError with a BAD_REQUEST code', () => {
      let captured: GraphQLError | undefined;
      try {
        validateCreateUserInput({ ...validInput, email: 'nope' });
      } catch (error) {
        captured = error as GraphQLError;
      }

      expect(captured).toBeInstanceOf(GraphQLError);
      expect(captured?.extensions).toMatchObject({ code: 'BAD_REQUEST', http: { status: 400 } });
    });
  });
});
