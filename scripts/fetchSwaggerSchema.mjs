import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

import { load } from 'js-yaml';

const swaggerPath = './contracts/user-service/openapi.json';
const version = process.env.USER_SERVICE_VERSION || 'v2.6.0';

export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;
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

/**
 * Drops null-valued keys recursively.
 *
 * The upstream spec emits `maxLength: null` and `format: null` on 168 schema
 * properties. Both are invalid per OpenAPI 3 — maxLength must be a non-negative
 * integer and format a string — they render as noise on the swagger page, and
 * they make `spectral lint` abort outright instead of reporting. Normalizing at
 * the single point where the document enters this repo keeps the committed
 * artifact a valid OpenAPI document. Nothing carrying meaning is removed.
 */
export function normalizeSpec(node) {
  if (Array.isArray(node)) {
    return node.map(normalizeSpec);
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([, value]) => value !== null)
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
