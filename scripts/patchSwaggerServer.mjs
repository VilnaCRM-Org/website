import 'dotenv/config';
import fs from 'node:fs';
import dotenvExpand from 'dotenv-expand';
import dotenv from 'dotenv';

const env = dotenv.config();
dotenvExpand.expand(env);

// Read the committed, pristine contract and emit the patched copy the swagger
// page serves. Source and destination are deliberately different files: the
// server URL is environment-specific (it becomes http://mockoon:8080 inside
// Docker), so patching in place would leave a container hostname in the working
// tree — and eventually in a commit — after every `make start`.
export const CONTRACT_PATH = './contracts/user-service/openapi.json';
export const OUTPUT_PATH = './public/swagger-schema.json';

export function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export function getApiBaseUrl() {
  return ensureEnv('NEXT_PUBLIC_API_BASE_URL');
}

/**
 * The single user-service pin from .env. The same tag drives the GraphQL schema
 * behind the Apollo mock, the Mockoon fixture and this spec; `make
 * lint-api-versions` fails if those consumers ever diverge again.
 */
export function getUserServiceVersion() {
  return ensureEnv('USER_SERVICE_VERSION');
}

export function readSwaggerSchema(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read or parse swagger schema at "${path}":`, error.message);
    process.exit(1);
    throw error;
  }
}

export function patchSwaggerServerUrl(doc, url) {
  const patchedDoc = { ...doc };

  if (Array.isArray(patchedDoc.servers) && patchedDoc.servers.length > 0) {
    patchedDoc.servers = [...patchedDoc.servers];
    patchedDoc.servers[0] = { ...patchedDoc.servers[0], url };
  } else {
    patchedDoc.servers = [{ url }];
  }

  return patchedDoc;
}

/**
 * Stamps the user-service release this spec was pinned from onto the served copy
 * (issue #381, F4 — OWASP API9:2023 Improper Inventory Management).
 *
 * Upstream ships a static `info.version` ("1.0.0") unrelated to the release it
 * belongs to, so `/swagger` advertised a version matching neither the documented
 * surface nor the GraphQL contract the product integrates. `info.version`
 * therefore becomes the pinned tag — the value swagger-ui renders beside the
 * title — the upstream document version is preserved under
 * `x-upstream-spec-version`, and `x-user-service-version` gives machine consumers
 * of `/swagger-schema.json` the same fact without scraping the page.
 */
export function stampUserServiceVersion(doc, version) {
  const info = { ...(doc.info ?? {}) };
  const upstreamVersion = info.version;

  return {
    ...doc,
    info: {
      ...info,
      version,
      'x-user-service-version': version,
      ...(upstreamVersion ? { 'x-upstream-spec-version': upstreamVersion } : {}),
    },
  };
}

export function writeSwaggerSchema(path, doc) {
  fs.writeFileSync(path, JSON.stringify(doc, null, 2));
  return `✅ Swagger spec patched: server ${doc.servers?.[0]?.url}, user-service ${doc.info?.version}`;
}

export function patchSwaggerSchema(contractPath = CONTRACT_PATH, outputPath = OUTPUT_PATH) {
  const patched = stampUserServiceVersion(
    patchSwaggerServerUrl(readSwaggerSchema(contractPath), getApiBaseUrl()),
    getUserServiceVersion()
  );

  return writeSwaggerSchema(outputPath, patched);
}

// Only patch when run as a script, so the helpers above stay importable from the
// unit suite. Matched on argv rather than import.meta because Jest transforms
// this module to CJS, where import.meta is not available — the same guard
// fetchSwaggerSchema.mjs uses.
if (process.argv[1]?.endsWith('patchSwaggerServer.mjs')) {
  console.log(patchSwaggerSchema());
}
