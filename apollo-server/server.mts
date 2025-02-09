/* eslint-disable */
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import dotenv from 'dotenv';
const defaultUrlSchema ='https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/graphql-spec/spec';
const SCHEMA_URL = process.env.SHEMA_URL || defaultUrlSchema;



async function getRemoteSchema(){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${SCHEMA_URL}`, {
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Schema fetch timeout after 5 seconds');
    }
    throw new Error(`Schema fetch failed: ${(error as Error).message}`);
  }

}

interface CreateUserInput {
  email: string;
  initials: string;
  clientMutationId: string;
}
interface User {
  id: string;
  confirmed: boolean;
  email: string;
  initials: string;
}

const resolvers = {
  Mutation: {
    createUser: async (_: unknown, { input }: { input: CreateUserInput }) => {
      try {
        const newUser: User = {
          id: "1",
          confirmed: true,
          email: input.email,
          initials: input.initials,
        };
        return {
          user: newUser,
          clientMutationId: input.clientMutationId,
        };
      } catch (error) {
        throw new Error(`Failed to create user: ${error}`);
      }
    },
  },
};


async function startServer():Promise<void> {
  try {
    const typeDefs:string = await getRemoteSchema();

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      // csrfPrevention: true, // Enable CSRF protection

      formatError: (error) => {
        console.error('GraphQL Error:', {
          message: error.message,
          locations: error.locations,
          path: error.path,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        });
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          locations: error.locations,
          path: error.path,
        };
      }
    });

    const cleanup = () => {
         console.log('Shutting down gracefully...');
          server.stop().then(() => process.exit(0));
       };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

    const { url } = await startStandaloneServer(server, { listen: { port: 4000, path:'/graphql' },
      context: async ({ req }) => {
        if (!req.headers['content-type'] || req.headers['content-type'].includes('text/plain')) {
          throw new Error("Invalid content-type header for CSRF prevention.");
        }
        return {};
      }, });
    console.log(`🚀 Server ready at ${url}`);
  }catch (error:unknown) {
    console.log((error as Error).message);
    process.exit(1);
  }

}
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
  process.exit(1);
});
startServer();

