import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

import { load } from 'js-yaml';

const swaggerPath = './contracts/user-service/openapi.json';

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

export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${requireUserServiceVersion()}/.github/openapi-spec/spec.yaml`;
}

export async function fetchSwaggerYaml(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL parameter is required and must be a string');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch swagger schema. HTTP status: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

// Keywords the upstream spec emits as `null` — `maxLength: null` on 158 schema
// properties and `format: null` on 166. Both are invalid per OpenAPI 3 (maxLength
// must be a non-negative integer, format a string), they render as noise on the
// swagger page, and they make `spectral lint` abort outright instead of reporting.
const DROP_WHEN_NULL = new Set(['maxLength', 'format']);

/**
 * Drops the invalid `null` keywords listed in DROP_WHEN_NULL, recursively.
 *
 * Scoped to those keys on purpose. A blanket "strip every null" would also delete
 * legitimate OpenAPI 3.1 metadata such as `default: null` or `example: null`, and
 * because the drift check normalizes both sides the same way, that deletion would
 * pass silently while mutating the committed contract. Normalizing at the single
 * point where the document enters this repo keeps the committed artifact a valid
 * OpenAPI document; nothing carrying meaning is removed.
 */
export function normalizeSpec(node) {
  if (Array.isArray(node)) {
    return node.map(normalizeSpec);
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key, value]) => !(value === null && DROP_WHEN_NULL.has(key)))
        .map(([key, value]) => [key, normalizeSpec(value)])
    );
  }
  return node;
}

export async function saveSwaggerJson(yamlText, filePath) {
  if (!yamlText || typeof yamlText !== 'string') {
    throw new Error('yamlText parameter is required and must be a string');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath parameter is required and must be a string');
  }
  const jsonContent = normalizeSpec(load(yamlText));
  await writeFile(filePath, `${JSON.stringify(jsonContent, null, 2)}\n`);
}

export async function refreshSwaggerSchema(url, filePath) {
  const swaggerSchema = await fetchSwaggerYaml(url);
  await saveSwaggerJson(swaggerSchema, filePath);
  console.log('✅ Swagger schema saved as JSON');
  return true;
}

// Only fetch when run as a script: lint-contracts.mjs imports the helpers above
// and an unguarded IIFE would hit the network on import. Matched on argv rather
// than import.meta because Jest transforms this module to CJS, where import.meta
// is not available.
if (process.argv[1]?.endsWith('fetchSwaggerSchema.mjs')) {
  (async () => {
    try {
      await refreshSwaggerSchema(buildSpecUrl(), swaggerPath);
    } catch (err) {
      console.error('❌ Failed to fetch/save swagger schema:', err);
      process.exitCode = 1;
    }
  })();
}
