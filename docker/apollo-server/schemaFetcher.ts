import * as fs from 'node:fs';
import * as path from 'node:path';

import dotenv, { DotenvConfigOutput } from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { createLogger, Logger, format, transports } from 'winston';

import {
  SchemaIntegrityError,
  assertSchemaIntegrity,
  readExpectedSchemaDigest,
} from './schemaIntegrity';

const env: DotenvConfigOutput = dotenv.config();

dotenvExpand.expand(env);

const SCHEMA_URL: string = process.env.GRAPHQL_SCHEMA_URL || '';

if (!SCHEMA_URL) {
  throw new Error(
    'Schema URL is not configured. Please set the GRAPHQL_SCHEMA_URL environment variable.'
  );
}

const OUTPUT_DIR: string = path.join(__dirname);
const OUTPUT_FILE: string = path.join(OUTPUT_DIR, 'schema.graphql');
const LOG_LEVEL: string = process.env.GRAPHQL_LOG_LEVEL || 'info';

const logger: Logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: 'app.log' })],
});
const MAX_RETRIES: number = Number(process.env.GRAPHQL_MAX_RETRIES) || 3;
const TIMEOUT_MS: number = Number(process.env.GRAPHQL_TIMEOUT_MS) || 5000;

export async function fetchAndSaveSchema(): Promise<void> {
  let retries: number = 0;
  let lastError: Error | null = null;

  while (retries < MAX_RETRIES) {
    if (retries > 0) {
      const backoffTime: number = Math.min(1000 * 2 ** retries, 10000);
      logger.info(`Retry attempt ${retries}/${MAX_RETRIES} after ${backoffTime}ms`);
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), backoffTime);
      });
    }

    logger.info(
      `Fetching OpenAPI schema from: ${SCHEMA_URL}... (Attempt ${retries + 1}/${MAX_RETRIES})`
    );

    const controller: AbortController = new AbortController();
    const timeoutId: NodeJS.Timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response: Response = await fetch(SCHEMA_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'GraphQL/SchemaFetcher',
          Accept: 'application/json',
        },
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.statusText}`);
      }

      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      const data: string = await response.text();
      assertSchemaIntegrity(data, readExpectedSchemaDigest());
      fs.writeFileSync(OUTPUT_FILE, data, 'utf-8');

      logger.info(`Schema successfully saved to: ${OUTPUT_FILE}`);
      return;
    } catch (error) {
      // A digest mismatch is not a transport failure, so it does not go through
      // the retry path — a retry re-downloads the same bytes.
      //
      // This discards the download and returns, which is not fail-open: the mock
      // keeps serving the schema Apollo.Dockerfile seeded from `contracts/`, i.e.
      // the reviewed contract rather than whatever the moved tag now points at.
      // Exiting instead would crashloop the container (`restart: unless-stopped`
      // in docker-compose.test.yml) and bury this message behind a healthcheck
      // timeout. `make lint-contracts` is what turns the same drift into a red PR.
      if (error instanceof SchemaIntegrityError) {
        logger.error(error.message);
        logger.error(`Discarded the download; keeping the vendored schema at ${OUTPUT_FILE}`);
        return;
      }

      lastError = error as Error;
      retries += 1;

      if ((error as Error).name === 'AbortError') {
        logger.error('Schema fetch timeout after configured time');
      } else {
        logger.error(`Schema fetch failed: ${(error as Error).message}`);
      }

      if (retries >= MAX_RETRIES) {
        break;
      }
    }
  }

  if (lastError) {
    if (process.env.NODE_ENV === 'production') {
      logger.info('Exiting process due to repeated errors...');
      process.exit(1);
    } else {
      logger.info('All retry attempts failed, but continuing execution...');
    }
  }
}
if (require.main === module) {
  fetchAndSaveSchema().catch(error => {
    logger.error('Fatal error during schema fetch:', error);
    process.exit(1);
  });
}
