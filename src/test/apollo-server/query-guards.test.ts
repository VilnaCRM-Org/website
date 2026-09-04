import { buildSchema, getIntrospectionQuery, parse, validate } from 'graphql';
import type { DocumentNode, GraphQLSchema, OperationDefinitionNode } from 'graphql';

import {
  DEFAULT_MAX_PAGE_SIZE,
  DEFAULT_MAX_QUERY_COST,
  DEFAULT_MAX_QUERY_DEPTH,
  DEFAULT_MAX_QUERY_TOKENS,
  MAX_TRAVERSAL_DEPTH,
  MAX_TRAVERSAL_VISITS,
  QUERY_GUARDS,
  QUERY_GUARD_EXTENSION,
  createQueryCostLimitRule,
  createQueryDepthLimitRule,
  createPageSizeLimitRule,
  createQueryGuardPlugins,
  operationPaginationVariables,
  createQueryGuardRules,
  introspectionEnabled,
  measureOperationCost,
  measureOperationDepth,
  paginationVariables,
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

function costOf(source: string, maxPageSize: number = DEFAULT_MAX_PAGE_SIZE): number {
  const document = parse(source);
  return measureOperationCost(operationOf(document), document, { schema, maxPageSize });
}

function validateWith(source: string, rule: ReturnType<typeof createQueryDepthLimitRule>) {
  return validate(schema, parse(source), [rule]);
}

/**
 * Deep enough to prove the walkers saturate rather than descend, while still inside
 * what graphql-js can parse — past roughly 2000 levels `parse` itself overflows,
 * which is exactly why the server also bounds parsing with `maxTokens`.
 */
const DEEP_NESTING = 500;

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
    expect(errors[0]?.message).toBe(
      'Query is too deep: it nests deeper than the maximum of 3 levels.'
    );
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

  it('saturates instead of walking a deeply nested document to the bottom', () => {
    // Without the bound the walker recurses once per level, so a deep enough
    // document blows the call stack before the guard can reject anything — the
    // control becoming the DoS it exists to prevent.
    const document = parse(nestedNodeQuery(DEEP_NESTING));

    expect(measureOperationDepth(operationOf(document), document, 8)).toBe(9);
  });

  it('rejects a deeply nested document instead of crashing', () => {
    const errors = validateWith(nestedNodeQuery(DEEP_NESTING), createQueryDepthLimitRule(8));

    expect(errors[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.DEPTH);
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

  it('stops pricing a fragment bomb instead of expanding it exponentially', () => {
    // The cycle guard only blocks repeats along the current path, so repeated
    // *acyclic* spreads expand exponentially: this document is a few hundred bytes
    // and would otherwise expand to 2^20 field visits before the budget is checked.
    const chain = Array.from(
      { length: 20 },
      (_unused, level) =>
        `fragment f${level} on User { ...f${level + 1} ...f${level + 1} ...f${level + 1} }`
    ).join('\n');
    const source = `
      query { user(id: "1") { ...f0 } }
      ${chain}
      fragment f20 on User { id }
    `;

    const cost = measureOperationCost(operationOf(parse(source)), parse(source), {
      schema,
      maxCost: DEFAULT_MAX_QUERY_COST,
    });

    // Saturates one past the budget instead of expanding the whole tree: every field
    // costs at least 1 here, so counting maxCost + 1 of them already settles the
    // verdict. Reaching this assertion at all is the regression signal — an unbounded
    // walk would blow Jest's per-test timeout long before returning.
    expect(cost).toBe(DEFAULT_MAX_QUERY_COST + 1);
  });

  it('defaults to a budget that leaves the shipped client operation headroom', () => {
    expect(DEFAULT_MAX_QUERY_COST).toBeGreaterThan(costOf(SIGNUP_OPERATION));
  });

  it('stops descending at the depth ceiling instead of walking to the bottom', () => {
    // The depth guard rejects such a document anyway, so the unexplored subtree is
    // simply not priced — the point is that the walk stays bounded.
    const document = parse(nestedNodeQuery(DEEP_NESTING));

    expect(measureOperationCost(operationOf(document), document, { schema, maxDepth: 8 })).toBe(9);
  });
});

describe('page-size guard', () => {
  it('accepts a literal bound at the ceiling', () => {
    expect(
      validateWith('query { users(first: 25) { totalCount } }', createPageSizeLimitRule(25))
    ).toHaveLength(0);
  });

  it.each(['first', 'last'])('rejects a literal %s above the ceiling', argument => {
    const errors = validateWith(
      `query { users(${argument}: 1000) { totalCount } }`,
      createPageSizeLimitRule(25)
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe('Page size 1000 exceeds the maximum of 25.');
    expect(errors[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.PAGE_SIZE);
  });

  it('collects every variable used as a list bound', () => {
    expect(
      paginationVariables(
        parse('query Q($a: Int, $b: Int, $c: Int) { users(first: $a) { totalCount } }')
      )
    ).toEqual(['a']);
  });

  it('scopes collection to the operation a request selected', () => {
    // A request naming `Cheap` must not be rejected because `Expensive` paginates.
    const document = parse(`
      query Cheap { user(id: "1") { id } }
      query Expensive($n: Int) { users(first: $n) { totalCount } }
    `);
    const cheap = document.definitions[0] as OperationDefinitionNode;

    expect(paginationVariables(document)).toEqual(['n']);
    expect(operationPaginationVariables(cheap, document)).toEqual([]);
  });

  it('follows only the fragments the selected operation spreads', () => {
    const document = parse(`
      query Cheap { user(id: "1") { ...safe } }
      query Expensive { users { ...paged } }
      fragment safe on User { id }
      fragment paged on UserCursorConnection { edges { node { id } } }
    `);
    const cheap = document.definitions[0] as OperationDefinitionNode;

    expect(operationPaginationVariables(cheap, document)).toEqual([]);
  });

  it('ignores a variable used somewhere other than a list bound', () => {
    expect(paginationVariables(parse('query Q($id: ID!) { user(id: $id) { id } }'))).toEqual([]);
  });

  describe('at request time, where variable values exist', () => {
    let server: MockServer | undefined;

    /** Narrows the teardown-guarded handle at the point of use. */
    function activeServer(): MockServer {
      if (!server) throw new Error('the mock server was not started');
      return server;
    }

    afterEach(async () => {
      try {
        await server?.stop();
      } finally {
        server = undefined;
        resetUsers();
      }
    });

    it('rejects a variable page size above the ceiling', async () => {
      // Validation cannot see variable values, so `users(first: $n)` would otherwise
      // be priced at the ceiling while the request supplied any Int it liked.
      server = await startMockServer({ maxPageSize: 25 });

      const { status, body } = await graphqlRequest(
        activeServer().url,
        'query Q($n: Int) { users(first: $n) { totalCount } }',
        { n: 100000 }
      );

      expect(status).toBe(400);
      expect(body.errors?.[0]?.message).toBe('The requested page size is too large.');
      expect(body.errors?.[0]?.extensions).toMatchObject({
        [QUERY_GUARD_EXTENSION]: QUERY_GUARDS.PAGE_SIZE,
        // Apollo defaults a plugin-thrown error to INTERNAL_SERVER_ERROR, which
        // would misreport a rejected request as a server fault.
        code: 'BAD_USER_INPUT',
      });
    });

    it('accepts a variable page size at the ceiling', async () => {
      server = await startMockServer({ maxPageSize: 25 });

      const { status, body } = await graphqlRequest(
        activeServer().url,
        'query Q($n: Int) { users(first: $n) { totalCount } }',
        { n: 25 }
      );

      expect(status).toBe(200);
      expect(body.errors).toBeUndefined();
    });
  });
});

describe('limit resolution from the environment', () => {
  it('uses the documented defaults when nothing is set', () => {
    expect(resolveQueryGuardLimits({})).toEqual({
      maxDepth: DEFAULT_MAX_QUERY_DEPTH,
      maxCost: DEFAULT_MAX_QUERY_COST,
      maxPageSize: DEFAULT_MAX_PAGE_SIZE,
      maxTokens: DEFAULT_MAX_QUERY_TOKENS,
    });
  });

  it('honours valid overrides', () => {
    expect(
      resolveQueryGuardLimits({
        GRAPHQL_MAX_QUERY_DEPTH: '4',
        GRAPHQL_MAX_QUERY_COST: '60',
        GRAPHQL_MAX_PAGE_SIZE: '5',
        GRAPHQL_MAX_QUERY_TOKENS: '900',
      })
    ).toEqual({ maxDepth: 4, maxCost: 60, maxPageSize: 5, maxTokens: 900 });
  });

  it.each([
    ['a non-numeric value', 'not-a-number'],
    ['zero', '0'],
    ['a negative value', '-5'],
    ['an empty value', ''],
    // `Number.parseInt` stops at the first non-digit, so this would silently
    // configure a limit of 8 if the whole value were not required to be numeric.
    ['a numeric prefix followed by junk', '8junk'],
    ['a decimal', '8.5'],
    ['a padded value', ' 8 '],
  ])('falls back to the default for %s instead of disabling the guard', (_label, raw) => {
    expect(resolveQueryGuardLimits({ GRAPHQL_MAX_QUERY_DEPTH: raw }).maxDepth).toBe(
      DEFAULT_MAX_QUERY_DEPTH
    );
  });

  it('clamps an over-large depth so a misconfiguration cannot unbound the walk', () => {
    expect(resolveQueryGuardLimits({ GRAPHQL_MAX_QUERY_DEPTH: '100000' }).maxDepth).toBe(
      MAX_TRAVERSAL_DEPTH
    );
  });

  it('clamps a cost budget that would sit at or above the traversal visit cap', () => {
    // Otherwise a document the walk merely stopped measuring would come back under
    // budget and be accepted.
    expect(resolveQueryGuardLimits({ GRAPHQL_MAX_QUERY_COST: '100000' }).maxCost).toBe(
      MAX_TRAVERSAL_VISITS - 1
    );
  });

  describe('the parse-time token bound', () => {
    it('leaves the shipped client operation and the introspection query room', () => {
      expect(() => parse(SIGNUP_OPERATION, { maxTokens: DEFAULT_MAX_QUERY_TOKENS })).not.toThrow();
      expect(() =>
        parse(getIntrospectionQuery(), { maxTokens: DEFAULT_MAX_QUERY_TOKENS })
      ).not.toThrow();
    });

    it('aborts a document nested deeply enough to overflow the parser itself', () => {
      // graphql-js parses by recursive descent, so this is the only bound that can
      // stop a pathological document — no validation rule ever runs on it.
      expect(() => parse(nestedNodeQuery(5000), { maxTokens: DEFAULT_MAX_QUERY_TOKENS })).toThrow(
        /Parsing aborted/
      );
    });
  });

  it('builds one rule per static guard, plus the request-time page-size plugin', () => {
    const limits = { maxDepth: 5, maxCost: 50, maxPageSize: 5, maxTokens: 100 };

    expect(createQueryGuardRules(limits)).toHaveLength(3);
    expect(createQueryGuardPlugins(limits)).toHaveLength(1);
  });
});

describe('introspection gating', () => {
  const originalNodeEnv: string | undefined = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it.each([
    ['development', true],
    ['production', false],
    ['test', false],
  ])('is %s -> %s', (nodeEnv, expected) => {
    expect(introspectionEnabled(nodeEnv)).toBe(expected);
  });

  // `nodeEnv` is a DEFAULT parameter, and JavaScript cannot tell an omitted argument
  // from an explicit `undefined` — both fall through to `process.env.NODE_ENV`. So the
  // fail-closed case has to control the ambient value instead of passing `undefined` and
  // hoping. Left uncontrolled it asserted whatever the runner happened to export, which
  // is green under Jest's default `NODE_ENV=test` and red inside the dev container #338
  // adds, where `remoteEnv` sets `NODE_ENV=development` exactly as the compose dev
  // service does.
  it('stays off when NODE_ENV is unset, however the argument is spelled', () => {
    delete process.env.NODE_ENV;

    expect(introspectionEnabled(undefined)).toBe(false);
    expect(introspectionEnabled()).toBe(false);
  });

  it('reads the ambient NODE_ENV when the argument is omitted', () => {
    process.env.NODE_ENV = 'development';

    expect(introspectionEnabled()).toBe(true);
  });
});

describe('the guards over HTTP, against the real mock', () => {
  let server: MockServer | undefined;

  /** Narrows the teardown-guarded handle at the point of use. */
  function activeServer(): MockServer {
    if (!server) throw new Error('the mock server was not started');
    return server;
  }

  afterEach(async () => {
    // Guarded: if startMockServer threw, dereferencing `server` here would mask the
    // original setup failure with a TypeError.
    try {
      await server?.stop();
    } finally {
      server = undefined;
      resetUsers();
    }
  });

  it('rejects an over-depth document with 400', async () => {
    server = await startMockServer({ maxDepth: 3 });

    const { status, body } = await graphqlRequest(activeServer().url, nestedNodeQuery(4));

    expect(status).toBe(400);
    expect(body.errors?.[0]?.message).toBe('The query is nested too deeply.');
    expect(body.errors?.[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.DEPTH);
  });

  it('rejects an over-budget document with 400', async () => {
    server = await startMockServer({ maxCost: 20 });

    const { status, body } = await graphqlRequest(
      activeServer().url,
      'query { users(first: 500) { edges { node { id email } } } }'
    );

    expect(status).toBe(400);
    expect(body.errors?.[0]?.message).toBe('The query is too expensive to execute.');
    expect(body.errors?.[0]?.extensions?.[QUERY_GUARD_EXTENSION]).toBe(QUERY_GUARDS.COST);
  });

  it('still accepts the operation the shipped client sends', async () => {
    server = await startMockServer();

    const { status, body } = await graphqlRequest(activeServer().url, SIGNUP_OPERATION, {
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

    const { body } = await graphqlRequest(
      activeServer().url,
      'query { __schema { queryType { name } } }'
    );

    expect(body.errors?.[0]?.message).toBe("Your query doesn't match the schema. Please check it!");
    expect(body.data).toBeUndefined();
  });

  it('allows introspection in local development', async () => {
    server = await startMockServer({ nodeEnv: 'development' });

    const { status, body } = await graphqlRequest(
      activeServer().url,
      'query { __schema { queryType { name } } }'
    );

    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data).toMatchObject({ __schema: { queryType: { name: 'Query' } } });
  });
});
