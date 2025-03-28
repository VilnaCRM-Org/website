import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
// @ts-ignore - Import path uses .ts extension which is resolved at runtime
import { CreateUserInput, User } from './type.ts';
// @ts-ignore - Using CommonJS module in ESM context
import dotenv from 'dotenv';
import { GraphQLError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';

dotenv.config();

const defaultUrlSchema =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/graphql-spec/spec';
const SCHEMA_URL = process.env.GRAPHQL_SCHEMA_URL || defaultUrlSchema;

export async function getRemoteSchema() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${SCHEMA_URL}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching remote schema:', error);

    if ((error as Error).name === 'AbortError') {
      throw new Error('Schema fetch timeout after 5 seconds');
    }
    const customError = new Error(`Schema fetch failed: ${(error as Error).message}`);
    (customError as any).cause = error; // Attach the original error as a custom property
    throw customError;
  }
}
const validateCreateUserInput = (input: CreateUserInput) => {
  if (!input.email || !input.email.includes('@')) {
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
      // Validate input
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
              headers: new Map([['x-error-type', 'server-error']]),
            },
          },
        });
      }
    },
  },
};
const formatError = (formattedError: any, error: any) => {
  // Handle 500 (server errors)
  if (formattedError.extensions.code === 'INTERNAL_SERVER_ERROR') {
    return {
      ...formattedError,
      message: 'Something went wrong on the server. Please try again later.',
      details: error.message,
    };
  }

  // Handle 400 (client errors)
  if (formattedError.extensions.code === 'BAD_REQUEST') {
    return {
      ...formattedError,
      message: 'The request was invalid. Please check your input.',
      details: error.message,
    };
  }

  // Handle other errors (e.g., validation)
  if (formattedError.extensions.code === ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED) {
    return {
      ...formattedError,
      message: "Your query doesn't match the schema. Please check it!",
    };
  }

  // Default behavior for other errors
  return formattedError;
};
async function startServer(): Promise<ApolloServer<BaseContext>> {
  try {
    const typeDefs: string = await getRemoteSchema();

    if (!typeDefs) {
      throw new Error('Failed to load remote schema.');
    }
    if (!resolvers || Object.keys(resolvers).length === 0) {
      throw new Error('Resolvers are missing or not defined properly.');
    }
    const server = new ApolloServer<BaseContext>({
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
        if (!req.headers['content-type'] || req.headers['content-type'].includes('text/plain')) {
          throw new Error('Invalid content-type header for CSRF prevention.');
        }
        return {};
      },
    });

    console.log(`🚀 Server ready at ${url}`);
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', error => {
  console.error('Unhandled Promise Rejection:', error);
  process.exit(1);
});

let isShuttingDown = false;

async function initializeServer() {
  try {
    const server = await startServer();

    // Attach shutdown handlers (only once)
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
    await server.close(); // Close server connections
  } catch (err) {
    console.error('Error while closing server connections:', err);
  }

  await cleanupResources();
}

// ✅ Handle startup failures
async function handleServerFailure() {
  console.log('Attempting to clean up before exiting...');
  await cleanupResources();
  process.exit(1);
}

// ✅ Cleanup function for external resources (e.g., DB connections)
async function cleanupResources() {
  try {
    console.log('Cleaning up resources...');

    // Example: Close DB connections
    await closeDatabaseConnections();

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error cleaning up resources:', err);
  }
}

// ✅ Example: Mock database close function
async function closeDatabaseConnections() {
  return new Promise(resolve => setTimeout(resolve, 1000)); // Simulate DB cleanup
}

// Start server with proper error handling
initializeServer().catch(error => {
  console.error('Fatal error during server initialization:', error);
  process.exit(1);
});
