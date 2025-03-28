import * as fs from 'node:fs';
import * as path from 'node:path';

import { config } from 'dotenv';
import { createLogger, Logger, format, transports } from 'winston';

config();

const SCHEMA_URL: string = process.env.MOCKOON_SCHEMA_URL || '';

if (!SCHEMA_URL) {
  throw new Error('Schema URL is not configured. Please set the SCHEMA_URL environment variable.');
}

const OUTPUT_DIR: string = path.join(__dirname);
const OUTPUT_FILE: string = path.join(OUTPUT_DIR, 'data.json');

const logger: Logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: 'app.log' })],
});

export async function fetchAndSaveSchema(): Promise<void> {
  logger.info(`Fetching OpenAPI schema from: ${SCHEMA_URL}...`);

  const controller: AbortController = new AbortController();
  const timeoutId: NodeJS.Timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Fetch schema
    const response: Response = await fetch(SCHEMA_URL, { signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId)
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save response as JSON
    const data: string = await response.text();
    fs.writeFileSync(OUTPUT_FILE, data, 'utf-8');

    logger.info(`Schema successfully saved to: ${OUTPUT_FILE}`);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      logger.error('Schema fetch timeout after 5 seconds');
    } else {
      logger.error(`Schema fetch failed: ${(error as Error).message}`);
    }
    if (process.env.MOCKOON_EXIT_ON_ERROR !== 'false') {
      logger.info('Exiting process due to error...');
      process.exit(1); // Exit with an error code
    } else {
      logger.info('Error handling complete, continuing with execution...');
    }
  }
}

if (require.main === module) {
  fetchAndSaveSchema().catch(error => {
    logger.error('Fatal error during schema fetch:', error);
    process.exit(1);
  });
}
