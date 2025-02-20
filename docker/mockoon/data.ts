import dotenv from 'dotenv';

dotenv.config();

const defaultUrlSchema: string =
  'https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml';

const SCHEMA_URL: string | undefined = process.env.MOCKOON_SCHEMA_URL || defaultUrlSchema;

export async function getRemoteJson(): Promise<string> {
  const controller: AbortController = new AbortController();
  const timeoutId: NodeJS.Timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response: Response = await fetch(`${SCHEMA_URL}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Schema fetch timeout after 5 seconds');
    }
    console.error(error);
    throw new Error(`Schema fetch failed: ${(error as Error).message}`);
  }
}

getRemoteJson()
  .then(data => {
    console.log('Fetched data:', data);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
