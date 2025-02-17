var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
/* eslint-disable */
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
const defaultUrlSchema =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/graphql-spec/spec';
const SCHEMA_URL = process.env.SHEMA_URL || defaultUrlSchema;
function getRemoteSchema() {
  return __awaiter(this, void 0, void 0, function* () {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = yield fetch(`${SCHEMA_URL}`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }
      return yield response.text();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Schema fetch timeout after 5 seconds');
      }
      throw new Error(`Schema fetch failed: ${error.message}`);
    }
  });
}
export const resolvers = {
  Mutation: {
    createUser: (_1, _a) =>
      __awaiter(void 0, [_1, _a], void 0, function* (_, { input }) {
        try {
          const newUser = {
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
          throw new Error(`Failed to create user: ${error}`);
        }
      }),
  },
};
function startServer() {
  return __awaiter(this, void 0, void 0, function* () {
    try {
      const typeDefs = yield getRemoteSchema();
      if (!typeDefs) {
        throw new Error('Failed to load remote schema.');
      }
      if (!resolvers || Object.keys(resolvers).length === 0) {
        throw new Error('Resolvers are missing or not defined properly.');
      }
      const server = new ApolloServer({
        typeDefs,
        resolvers,
        // csrfPrevention: true,
        csrfPrevention: {
          requestHeaders: [
            'Apollo-Require-Preflight', // For web clients
            'X-Apollo-Operation-Name', // For mobile clients
          ],
        },
        formatError: error => {
          var _a, _b;
          console.error('GraphQL Error:', {
            message: error.message,
            locations: error.locations,
            path: error.path,
            code:
              ((_a = error.extensions) === null || _a === void 0 ? void 0 : _a.code) ||
              'INTERNAL_SERVER_ERROR',
          });
          return {
            message: error.message,
            code:
              ((_b = error.extensions) === null || _b === void 0 ? void 0 : _b.code) ||
              'INTERNAL_SERVER_ERROR',
            locations: error.locations,
            path: error.path,
          };
        },
      });
      const { url } = yield startStandaloneServer(server, {
        listen: { port: 4000 },
        context: _a =>
          __awaiter(this, [_a], void 0, function* ({ req }) {
            if (
              !req.headers['content-type'] ||
              req.headers['content-type'].includes('text/plain')
            ) {
              throw new Error('Invalid content-type header for CSRF prevention.');
            }
            return {};
          }),
      });
      console.log(`🚀 Server ready at ${url}`);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });
}
process.on('unhandledRejection', error => {
  console.error('Unhandled Promise Rejection:', error);
  process.exit(1);
});
startServer();
