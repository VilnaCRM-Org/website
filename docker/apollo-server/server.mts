import dotenv, { DotenvConfigOutput } from 'dotenv';
import dotenvExpand from 'dotenv-expand';
const env: DotenvConfigOutput = dotenv.config();

dotenvExpand.expand(env);

import { ApolloServer, BaseContext } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import * as landingPage from '@apollo/server/plugin/landingPage/default';

import { formatError } from './error-formatting.js';
import {
  createQueryGuardPlugins,
  createQueryGuardRules,
  introspectionEnabled,
  resolveQueryGuardLimits,
} from './query-guards.js';
import { resolvers } from './resolvers.js';

import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GRAPHQL_API_PATH = process.env.GRAPHQL_API_PATH || 'graphql';
const HEALTH_CHECK_PATH = process.env.HEALTH_CHECK_PATH || 'health';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_FILE_PATH = path.join(__dirname, 'schema.graphql');

let server: ApolloServer<BaseContext>;

async function startServer() {
  try {
    const typeDefs: string = fs.readFileSync(SCHEMA_FILE_PATH, 'utf-8');

    if (!typeDefs) {
      throw new Error('Failed to load remote schema.');
    }

    if (!resolvers || Object.keys(resolvers).length === 0) {
      throw new Error('Resolvers are missing or not defined properly.');
    }

    const isLocalDev = introspectionEnabled();
    const limits = resolveQueryGuardLimits();

    server = new ApolloServer<BaseContext>({
      typeDefs,
      resolvers,
      csrfPrevention: {
        requestHeaders: ['Apollo-Require-Preflight', 'X-Apollo-Operation-Name'],
      },
      formatError,
      // Depth + cost budget (issue #381, F3). Without these an unauthenticated
      // client can amplify CPU/memory with a nested or heavily-aliased document.
      validationRules: createQueryGuardRules(limits),
      // graphql-js parses by recursive descent, so a deeply nested document would
      // crash the parser before any validation rule could run. Bound it too.
      parseOptions: { maxTokens: limits.maxTokens },
      // Schema disclosure and the embedded Sandbox console are local-development
      // affordances only. Everywhere else they are recon surface.
      introspection: isLocalDev,
      plugins: [
        isLocalDev
          ? landingPage.ApolloServerPluginLandingPageLocalDefault()
          : ApolloServerPluginLandingPageDisabled(),
        // Page-size ceiling for variable bounds: validation cannot see variable
        // values, so it is re-checked at didResolveOperation, before execution.
        ...createQueryGuardPlugins(limits),
      ],
      // Apollo attaches `extensions.stacktrace` outside production/test. Pin it
      // off so an internal stack can never ride out on an error response.
      includeStacktraceInErrorResponses: false,
    });

    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },

      context: async ({ req }) => {
        if (req.url === HEALTH_CHECK_PATH) {
          return {};
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
    setTimeout(() => {
      process.exit(1);
    }, 3000);
  }
}

process.on('unhandledRejection', async (reason, promise) => {
  const timestamp = new Date().toISOString();

  console.error(`[${timestamp}] Unhandled Promise Rejection:`, { reason, promise });

  if (shouldShutdown(reason)) {
    console.error(`[${timestamp}] Critical error detected, initiating graceful shutdown...`);
    await gracefulShutdownAndExit(server);
  } else {
    console.warn(`[${timestamp}] Recoverable error, system will continue running.`);
  }
});

function shouldShutdown(error: unknown): boolean {
  return error instanceof Error && error.message.includes('critical');
}
async function gracefulShutdownAndExit(
  server: any,
  timeout: number = Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 10000
) {
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
