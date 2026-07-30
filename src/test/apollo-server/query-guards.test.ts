import { buildSchema, parse, validate } from 'graphql';
import type { DocumentNode, GraphQLSchema, OperationDefinitionNode } from 'graphql';

import {
  DEFAULT_LIST_SIZE,
  DEFAULT_MAX_QUERY_COST,
  DEFAULT_MAX_QUERY_DEPTH,
  QUERY_GUARDS,
  QUERY_GUARD_EXTENSION,
  createQueryCostLimitRule,
  createQueryDepthLimitRule,
  createQueryGuardRules,
  introspectionEnabled,
  measureOperationCost,
  measureOperationDepth,
  resolveQueryGuardLimits,
} from '../../../docker/apollo-server/query-guards';
import { resetUsers } from '../../../docker/apollo-server/resolvers';

import { MockServer, graphqlRequest, readPinnedSchema, startMockServer } from './mock-server';

/**
 * Issue #381 / F3 — the mock shipped with no `validationRules` and left
 * introspection and the Sandbox on. These specs pin the replacement behaviour.
 *
 * Scenario classes: positive (a realistic operation validates), negative (an
 * over-depth / over-budget document is rejected), boundary (exactly at each limit,
 * cyclic and missing fragments, meta-field exemption, malformed env overrides).
 *
 * Locale / responsive / a11y — Not applicable: no UI is rendered by this layer.
 */

const schema: GraphQLSchema = buildSchema(readPinnedSchema());

const SIGNUP_OPERATION = `
  mutation CreateUser($input: createUserInput!) {
    createUser(input: $input) {
      user { id email initials confirmed }
      clientMutationId
    }
  }
`;

function operationOf(document: DocumentNode): OperationDefinitionNode {
  const operation = document.definitions.find(
    definition => definition.kind === 'OperationDefinition'
  );
  if (!operation) throw new Error('the fixture has no operation definition');
  return operation as OperationDefinitionNode;
}

function depthOf(source: string): number {
  const document = parse(source);
  return measureOperationDepth(operationOf(document), document);
}

function costOf(source: string, defaultListSize: number = DEFAULT_LIST_SIZE): number {
  const document = parse(source);
  return measureOperationCost(operationOf(document), document, schema, defaultListSize);
}

function validateWith(source: string, rule: ReturnType<typeof createQueryDepthLimitRule>) {
  return validate(schema, parse(source), [rule]);
}

/** Builds `user(id:"1"){ node { ... } }`-style nesting to a requested depth. */
function nestedNodeQuery(levels: number): string {
  const open = '{ node '.repeat(levels);
  const close = '}'.repeat(levels);
  return `query { node(id: "1") ${open} { id } ${close} }`;
}

describe('query depth guard', () => {
  it('measures a realistic signup mutation as shallow', () => {
    expect(depthOf(SIGNUP_OPERATION)).toBe(3);
  });

  it('accepts an operation exactly at the limit', () => {
    const source = nestedNodeQuery(2);

    expect(depthOf(source)).toBe(4);
    expect(validateWith(source, createQueryDepthLimitRule(4))).toHaveLength(0);
  });

  it('rejects an operation one level over the limit', () => {
    const errors = validateWith(nestedNodeQuery(2), createQueryDepthLimitRule(3));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe('Query is too deep: 4 levels exceeds the maximum of 3.');
    expect(errors[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.DEPTH);
  });

  it('counts depth reached through a fragment spread', () => {
    const source = `
      query { node(id: "1") { ...deep } }
      fragment deep on Node { ... on User { id } }
    `;

    expect(depthOf(source)).toBe(2);
  });

  it('does not recurse forever on a cyclic fragment spread', () => {
    const source = `
      query { node(id: "1") { ...a } }
      fragment a on Node { ...b }
      fragment b on Node { ...a }
    `;

    expect(depthOf(source)).toBe(1);
  });

  it('ignores a spread of a fragment that does not exist', () => {
    expect(depthOf('query { node(id: "1") { ...missing } }')).toBe(1);
  });

  it('exempts introspection meta-fields so the standard schema query stays usable', () => {
    expect(depthOf('query { __schema { types { fields { type { ofType { name } } } } } }')).toBe(0);
  });

  it('defaults to a limit that leaves the shipped client operation headroom', () => {
    expect(DEFAULT_MAX_QUERY_DEPTH).toBeGreaterThan(depthOf(SIGNUP_OPERATION));
  });
});

describe('query cost guard', () => {
  it('prices a realistic signup mutation cheaply', () => {
    expect(costOf(SIGNUP_OPERATION)).toBe(7);
  });

  it('prices every alias separately so breadth amplification is caught', () => {
    const single = costOf('query { user(id: "1") { id } }');
    const aliased = costOf('query { a: user(id: "1") { id } b: user(id: "2") { id } }');

    expect(aliased).toBe(single * 2);
  });

  it('multiplies the subtree by an explicit list bound', () => {
    expect(costOf('query { users(first: 10) { edges { node { id } } } }')).toBe(1 + 10 * 3);
  });

  it('nests multipliers so pagination amplification compounds', () => {
    const cost = costOf(
      'query { users(first: 10) { edges { node { ...on User { id email } } } } }'
    );

    expect(cost).toBeGreaterThan(costOf('query { users(first: 1) { edges { node { id } } } }'));
  });

  it('falls back to the default page size when the bound is a variable', () => {
    const cost = costOf('query Q($n: Int) { users(first: $n) { totalCount } }', 25);

    expect(cost).toBe(1 + 25);
  });

  it('falls back to the default page size when a paginated field omits its bound', () => {
    expect(costOf('query { users { totalCount } }', 25)).toBe(1 + 25);
  });

  it('does not multiply a field the schema does not paginate', () => {
    expect(costOf('query { user(id: "1") { id email initials } }')).toBe(4);
  });

  it('rejects a document over the budget and tags the guard', () => {
    const errors = validateWith(
      'query { users(first: 1000) { edges { node { id email initials confirmed } } } }',
      createQueryCostLimitRule(100)
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/^Query is too expensive: estimated cost \d+ exceeds/);
    expect(errors[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.COST);
  });

  it('accepts a document exactly at the budget', () => {
    const source = 'query { user(id: "1") { id email initials } }';

    expect(costOf(source)).toBe(4);
    expect(validateWith(source, createQueryCostLimitRule(4))).toHaveLength(0);
  });

  it('does not recurse forever on a cyclic fragment spread', () => {
    const source = `
      query { node(id: "1") { ...a } }
      fragment a on Node { ...b }
      fragment b on Node { ...a }
    `;

    expect(costOf(source)).toBe(1);
  });

  it('exempts introspection meta-fields', () => {
    expect(costOf('query { __typename __schema { queryType { name } } }')).toBe(0);
  });

  it('defaults to a budget that leaves the shipped client operation headroom', () => {
    expect(DEFAULT_MAX_QUERY_COST).toBeGreaterThan(costOf(SIGNUP_OPERATION));
  });
});

describe('limit resolution from the environment', () => {
  it('uses the documented defaults when nothing is set', () => {
    expect(resolveQueryGuardLimits({})).toEqual({
      maxDepth: DEFAULT_MAX_QUERY_DEPTH,
      maxCost: DEFAULT_MAX_QUERY_COST,
      defaultListSize: DEFAULT_LIST_SIZE,
    });
  });

  it('honours valid overrides', () => {
    expect(
      resolveQueryGuardLimits({
        GRAPHQL_MAX_QUERY_DEPTH: '4',
        GRAPHQL_MAX_QUERY_COST: '60',
        GRAPHQL_DEFAULT_LIST_SIZE: '5',
      })
    ).toEqual({ maxDepth: 4, maxCost: 60, defaultListSize: 5 });
  });

  it.each([
    ['a non-numeric value', 'not-a-number'],
    ['zero', '0'],
    ['a negative value', '-5'],
    ['an empty value', ''],
  ])('falls back to the default for %s instead of disabling the guard', (_label, raw) => {
    expect(resolveQueryGuardLimits({ GRAPHQL_MAX_QUERY_DEPTH: raw }).maxDepth).toBe(
      DEFAULT_MAX_QUERY_DEPTH
    );
  });

  it('builds one rule per guard', () => {
    expect(createQueryGuardRules({ maxDepth: 5, maxCost: 50, defaultListSize: 5 })).toHaveLength(2);
  });
});

describe('introspection gating', () => {
  it.each([
    ['development', true],
    ['production', false],
    ['test', false],
    [undefined, false],
  ])('is %s -> %s', (nodeEnv, expected) => {
    expect(introspectionEnabled(nodeEnv)).toBe(expected);
  });
});

describe('the guards over HTTP, against the real mock', () => {
  let server: MockServer;

  afterEach(async () => {
    await server.stop();
    resetUsers();
  });

  it('rejects an over-depth document with 400', async () => {
    server = await startMockServer({ maxDepth: 3 });

    const { status, body } = await graphqlRequest(server.url, nestedNodeQuery(4));

    expect(status).toBe(400);
    expect(body.errors?.[0]?.message).toMatch(/^Query is too deep/);
    expect(body.errors?.[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.DEPTH);
  });

  it('rejects an over-budget document with 400', async () => {
    server = await startMockServer({ maxCost: 20 });

    const { status, body } = await graphqlRequest(
      server.url,
      'query { users(first: 500) { edges { node { id email } } } }'
    );

    expect(status).toBe(400);
    expect(body.errors?.[0]?.message).toMatch(/^Query is too expensive/);
    expect(body.errors?.[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.COST);
  });

  it('still accepts the operation the shipped client sends', async () => {
    server = await startMockServer();

    const { status, body } = await graphqlRequest(server.url, SIGNUP_OPERATION, {
      input: {
        email: 'guarded@example.com',
        initials: 'GU',
        password: 'Strong-Password-123',
        clientMutationId: 'guarded-1',
      },
    });

    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
  });

  it('refuses introspection outside local development', async () => {
    server = await startMockServer({ nodeEnv: 'production' });

    const { body } = await graphqlRequest(server.url, 'query { __schema { queryType { name } } }');

    expect(body.errors?.[0]?.message).toBe("Your query doesn't match the schema. Please check it!");
    expect(body.data).toBeUndefined();
  });

  it('allows introspection in local development', async () => {
    server = await startMockServer({ nodeEnv: 'development' });

    const { status, body } = await graphqlRequest(
      server.url,
      'query { __schema { queryType { name } } }'
    );

    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data).toMatchObject({ __schema: { queryType: { name: 'Query' } } });
  });
});
