import fs from 'node:fs';
import path from 'node:path';

import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import type { GraphQLFormattedError } from 'graphql';

import { createFormatError } from '../../../docker/apollo-server/error-formatting';
import {
  QueryGuardLimits,
  createQueryGuardRules,
  introspectionEnabled,
  resolveQueryGuardLimits,
} from '../../../docker/apollo-server/query-guards';
import { resolvers } from '../../../docker/apollo-server/resolvers';

/**
 * Boots the REAL Apollo mock — the resolvers, error formatter and query guards
 * that `docker/apollo-server/server.mts` wires up — against the REAL pinned
 * user-service schema.
 *
 * The pre-existing suite (`server.test.ts`) builds its own inline SDL and its own
 * resolver doubles, so it can never fail when the shipped mock regresses. Issue
 * #381 needs the opposite: assertions against the thing that actually runs.
 */

export const PINNED_SCHEMA_PATH: string = path.join(
  process.cwd(),
  'contracts/user-service/schema.graphql'
);

export function readPinnedSchema(): string {
  return fs.readFileSync(PINNED_SCHEMA_PATH, 'utf-8');
}

export interface MockServerOptions {
  /** `NODE_ENV` the server should behave as; drives introspection + Sandbox. */
  nodeEnv?: string | undefined;
  maxDepth?: number | undefined;
  maxCost?: number | undefined;
  defaultListSize?: number | undefined;
  /** Swap the resolvers to force an unexpected internal failure. */
  resolverOverrides?: { Mutation: { createUser: (...args: never[]) => never } } | undefined;
}

export interface MockServer {
  url: string;
  /** Everything `formatError` logged server-side, so tests can assert on it. */
  errorLog: jest.Mock;
  stop: () => Promise<void>;
}

export interface GraphQLHttpResponse {
  status: number;
  body: {
    data?: Record<string, unknown> | null;
    errors?: GraphQLFormattedError[];
  };
  raw: string;
}

export async function startMockServer(options: MockServerOptions = {}): Promise<MockServer> {
  const errorLog: jest.Mock = jest.fn();
  const isLocalDev: boolean = introspectionEnabled(options.nodeEnv ?? 'production');

  // Start from the shipped defaults rather than restating them here, so a budget
  // change cannot silently leave this harness testing different limits.
  const defaults: QueryGuardLimits = resolveQueryGuardLimits({});
  const limits: QueryGuardLimits = {
    maxDepth: options.maxDepth ?? defaults.maxDepth,
    maxCost: options.maxCost ?? defaults.maxCost,
    defaultListSize: options.defaultListSize ?? defaults.defaultListSize,
    maxTokens: defaults.maxTokens,
  };

  const server: ApolloServer<BaseContext> = new ApolloServer<BaseContext>({
    typeDefs: readPinnedSchema(),
    resolvers: options.resolverOverrides ?? resolvers,
    csrfPrevention: {
      requestHeaders: ['Apollo-Require-Preflight', 'X-Apollo-Operation-Name'],
    },
    formatError: createFormatError({ error: errorLog }),
    validationRules: createQueryGuardRules(limits),
    parseOptions: { maxTokens: limits.maxTokens },
    introspection: isLocalDev,
    includeStacktraceInErrorResponses: false,
  });

  const { url } = await startStandaloneServer(server, { listen: { port: 0 } });

  return {
    url,
    errorLog,
    stop: async (): Promise<void> => {
      await server.stop();
    },
  };
}

export async function graphqlRequest(
  url: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLHttpResponse> {
  const response: Response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });

  const raw: string = await response.text();

  return { status: response.status, body: JSON.parse(raw), raw };
}

export const CREATE_USER_MUTATION: string = `
  mutation CreateUser($input: createUserInput!) {
    createUser(input: $input) {
      user {
        id
        email
        initials
        confirmed
      }
      clientMutationId
    }
  }
`;
