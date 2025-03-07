import * as fs from 'node:fs';
import * as path from 'node:path';

import { config } from 'dotenv';

config();

const defaultUrlSchema: string =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml';

const SCHEMA_URL: string = process.env.MOCKOON_SCHEMA_URL || defaultUrlSchema;

const OUTPUT_DIR: string = path.join(__dirname);
const OUTPUT_FILE: string = path.join(OUTPUT_DIR, 'data.json');

export async function fetchAndSaveSchema(): Promise<void> {
  const controller: AbortController = new AbortController();
  const timeoutId: NodeJS.Timeout = setTimeout(() => controller.abort(), 5000);

  try {
    console.log(`Fetching OpenAPI schema from: ${SCHEMA_URL}...`);

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

    console.log(`Schema successfully saved to: ${OUTPUT_FILE}`);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Schema fetch timeout after 5 seconds');
    } else {
      console.error(`Schema fetch failed: ${(error as Error).message}`);
    }
    process.exit(1); // Exit with an error code
  }
}

fetchAndSaveSchema();
