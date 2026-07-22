import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

const schemaPath = './contracts/user-service/schema.graphql';

// USER_SERVICE_VERSION is the single pin for every user-service contract and
// lives in .env. Refuse to fall back to a hidden default: a silent default would
// let a refresh or the drift check run against the wrong generation of the spec.
function requireUserServiceVersion() {
  const version = process.env.USER_SERVICE_VERSION;
  if (!version) {
    throw new Error(
      'USER_SERVICE_VERSION is not set — define it in .env (the single user-service pin).'
    );
  }
  return version;
}

export function buildSchemaUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${requireUserServiceVersion()}/.github/graphql-spec/spec`;
}

export async function fetchGraphqlSchema(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL parameter is required and must be a string');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch GraphQL schema. HTTP status: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

export async function saveGraphqlSchema(sdl, filePath) {
  if (!sdl || typeof sdl !== 'string') {
    throw new Error('sdl parameter is required and must be a string');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath parameter is required and must be a string');
  }
  await writeFile(filePath, sdl);
}

export async function refreshGraphqlSchema(url, filePath) {
  const sdl = await fetchGraphqlSchema(url);
  await saveGraphqlSchema(sdl, filePath);
  console.log('✅ GraphQL schema saved');
  return true;
}

// Only fetch when run as a script — see the note in fetchSwaggerSchema.mjs.
if (process.argv[1]?.endsWith('fetchGraphqlSchema.mjs')) {
  (async () => {
    try {
      await refreshGraphqlSchema(buildSchemaUrl(), schemaPath);
    } catch (err) {
      console.error('❌ Failed to fetch/save GraphQL schema:', err);
      process.exitCode = 1;
    }
  })();
}
