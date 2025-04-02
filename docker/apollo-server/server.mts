import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
// @ts-ignore - Import path uses .ts extension which is resolved at runtime
import { CreateUserInput, User } from './type.ts';
import dotenv from 'dotenv';
import { GraphQLError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';

dotenv.config();

const GRAPHQL_API_PATH = process.env.GRAPHQL_API_PATH || 'graphql';
const HEALTH_CHECK_PATH = process.env.HEALTH_CHECK_PATH || 'health';

const defaultUrlSchema =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/graphql-spec/spec';
const SCHEMA_URL = process.env.GRAPHQL_SCHEMA_URL || defaultUrlSchema;

export async function getRemoteSchema() {
  const FETCH_TIMEOUT = process.env.FETCH_TIMEOUT ? Number(process.env.FETCH_TIMEOUT) : 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(`${SCHEMA_URL}`, { signal: controller.signal });

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText} (${response.status})`);
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching remote schema:', error);

    if ((error as Error).name === 'AbortError') {
      throw new Error(`Schema fetch timeout after ${FETCH_TIMEOUT / 1000} seconds`);
    }
    throw new Error(`Schema fetch failed: ${(error as Error).message}`);
  }
}
const validateCreateUserInput = (input: CreateUserInput) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!input.email || !emailRegex.test(input.email)) {
    throw new GraphQLError('Invalid email format', {
      extensions: {
        code: 'BAD_REQUEST',
        http: { status: 400 },
      },
    });
  }

  if (!input.initials || input.initials.length < 2) {
    throw new GraphQLError('Invalid initials', {
      extensions: {
        code: 'BAD_REQUEST',
        http: { status: 400 },
      },
    });
  }
};

export const resolvers = {
  Mutation: {
    createUser: async (_: unknown, { input }: { input: CreateUserInput }) => {
      validateCreateUserInput(input);
      try {
        const newUser: User = {
          id: '1',
          confirmed: true,
          email: input.email,
          initials: input.initials,
        };
        return {
          user: newUser,
          clientMutationId: input.clientMutationId,
        };
      } catch (error) {
        throw new GraphQLError('Internal Server Error: Failed to create user', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            http: {
              status: 500,
              headers: { 'x-error-type': 'server-error' },
            },
          },
        });
      }
    },
  },
};
const formatError = (formattedError: any, error: any) => {
  if (formattedError.extensions.code === 'INTERNAL_SERVER_ERROR') {
    return {
      ...formattedError,
      message: 'Something went wrong on the server. Please try again later.',
      details: error.message,
    };
  }

  if (formattedError.extensions.code === 'BAD_REQUEST') {
    return {
      ...formattedError,
      message: 'The request was invalid. Please check your input.',
      details: error.message,
    };
  }

  if (formattedError.extensions.code === ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED) {
    return {
      ...formattedError,
      message: "Your query doesn't match the schema. Please check it!",
    };
  }

  return formattedError;
};
let server: ApolloServer<BaseContext>;
async function startServer() {
  try {
    const typeDefs: string = await getRemoteSchema();

    if (!typeDefs) {
      throw new Error('Failed to load remote schema.');
    }

    if (!resolvers || Object.keys(resolvers).length === 0) {
      throw new Error('Resolvers are missing or not defined properly.');
    }

    server = new ApolloServer<BaseContext>({
      typeDefs,
      resolvers,
      csrfPrevention: {
        requestHeaders: [
          'Apollo-Require-Preflight', // For web clients
          'X-Apollo-Operation-Name', // For mobile clients
        ],
      },
      formatError,
    });

    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },

      context: async ({ req }) => {
        if (req.url === HEALTH_CHECK_PATH) {
          throw new GraphQLError('Health check endpoint', {
            extensions: {
              http: { status: 200 },
              code: 'HEALTH_CHECK',
            },
          });
        }

        if (!req.headers['content-type'] || req.headers['content-type'].includes('text/plain')) {
          throw new Error('Invalid content-type header for CSRF prevention.');
        }
        return {};
      },
    });

    console.log(`🚀 GraphQL API ready at ${url}${GRAPHQL_API_PATH}`);
    console.log(`✅ Health Check at ${url}${HEALTH_CHECK_PATH}`);

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    if (server) {
      await gracefulShutdownAndExit(server);
    }
    process.exit(1);
  }
}

process.on('unhandledRejection', async error => {
  console.error('Unhandled Promise Rejection:', error);

  await gracefulShutdownAndExit(server);
});
async function gracefulShutdownAndExit(server: any, timeout: number = 10000) {
  console.log('Initiating graceful shutdown...');

  if (server) {
    const shutdownTimeout = setTimeout(() => {
      console.error('Graceful shutdown timeout reached. Forcing exit.');
      process.exit(1);
    }, timeout);
    try {
      await server.stop();
      console.log('Server stopped gracefully.');

      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (shutdownError) {
      console.error('Error during graceful shutdown:', shutdownError);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  } else {
    console.error('No server instance found for shutdown.');
    process.exit(1);
  }
}

let isShuttingDown = false;

async function initializeServer() {
  try {
    const server = await startServer();

    if (!isShuttingDown) {
      process.once('SIGINT', () => handleShutdown(server, 'SIGINT'));
      process.once('SIGTERM', () => handleShutdown(server, 'SIGTERM'));
    }

    return server;
  } catch (error) {
    console.error('Error starting server:', error);
    await handleServerFailure();
  }
}

async function handleShutdown(server: any, signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}. Gracefully shutting down...`);

  try {
    await shutdown(server);
    console.log('Server shutdown completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during server shutdown:', error);
    process.exit(1);
  }
}

async function shutdown(server: any) {
  try {
    if (server && typeof server.stop === 'function') {
      await server.stop();
      console.log('Apollo Server stopped');
    } else {
      console.warn('Server instance missing stop method');
    }
  } catch (err) {
    console.error('Error while closing server connections:', err);
    const error = new Error('Failed to shut down the server gracefully');
    (error as any).cause = err;
    throw error;
  }

  await cleanupResources();
}

async function handleServerFailure() {
  console.log('Attempting to clean up before exiting...');
  await cleanupResources();
  await gracefulShutdownAndExit(server);
}

async function cleanupResources() {
  try {
    console.log('Cleaning up resources...');

    await closeDatabaseConnections();

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error cleaning up resources:', err);
  }
}

async function closeDatabaseConnections() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}

initializeServer().catch(error => {
  console.error('Fatal error during server initialization:', error);
  process.exit(1);
});
