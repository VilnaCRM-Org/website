import 'dotenv/config';
import fs from 'node:fs';
import dotenvExpand from 'dotenv-expand';
import dotenv from 'dotenv';

const env = dotenv.config();
dotenvExpand.expand(env);

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

export function readSwaggerSchema(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read or parse swagger schema at "${path}":`, error.message);
    process.exit(1);
  }
}

// The only positions swagger-ui reads a server list from, per the OpenAPI spec:
// the document root, a Path Item, and an Operation.
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const isPlainObject = node => Boolean(node) && typeof node === 'object' && !Array.isArray(node);

const withoutServers = node =>
  Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'servers'));

/** Drops a Path Item's own `servers` and each of its operations'. */
function stripPathItemServers(pathItem) {
  if (!isPlainObject(pathItem)) {
    return pathItem;
  }
  return Object.fromEntries(
    Object.entries(withoutServers(pathItem)).map(([key, value]) =>
      HTTP_METHODS.has(key.toLowerCase()) && isPlainObject(value)
        ? [key, withoutServers(value)]
        : [key, value]
    )
  );
}

/**
 * Strips the `servers` overrides swagger-ui would offer alongside the root list.
 *
 * OpenAPI allows a `servers` override on a Path Item and on an Operation, and
 * swagger-ui puts those in the same "Try it out" dropdown as the root array —
 * preselected, in fact, since an operation-level server overrides the global one.
 * Rebuilding only the root would leave that sink open, and the ingestion guard
 * cannot close it either: an injected `https://attacker.example` is a perfectly
 * well-formed https URL.
 *
 * Walks the containers that actually hold Path Items rather than deleting every
 * key named `servers`. A blanket recursive filter also deleted a schema property
 * and an example payload field that merely happened to be called `servers`,
 * silently changing the vendored document.
 */
function stripPathItemContainer(container) {
  if (!isPlainObject(container)) {
    return container;
  }
  return Object.fromEntries(
    Object.entries(container).map(([key, value]) => [key, stripPathItemServers(value)])
  );
}

/**
 * Replaces `servers` wholesale with the single build-controlled entry.
 *
 * Overriding only `servers[0]` (the previous behaviour) let every other entry in
 * the vendored document survive into `public/swagger-schema.json`, where the
 * swagger "Try it out" console offers them in its server dropdown. An extra
 * `servers[1]` pointing at an attacker origin is therefore one click away from
 * receiving a token a user types into the live API console. The build knows
 * exactly one correct origin, so the array is rebuilt rather than patched — at
 * the root and at every nested override.
 */
export function patchSwaggerServerUrl(doc, url) {
  const patched = { ...doc, servers: [{ url }] };

  if (isPlainObject(patched.paths)) {
    patched.paths = stripPathItemContainer(patched.paths);
  }
  if (isPlainObject(patched.webhooks)) {
    patched.webhooks = stripPathItemContainer(patched.webhooks);
  }
  if (isPlainObject(patched.components) && isPlainObject(patched.components.pathItems)) {
    patched.components = {
      ...patched.components,
      pathItems: stripPathItemContainer(patched.components.pathItems),
    };
  }

  return patched;
}

export function writeSwaggerSchema(path, doc) {
  fs.writeFileSync(path, JSON.stringify(doc, null, 2));
  // Read through optional access: `servers` is optional on the exported type, so
  // a caller passing a document without one must not get a TypeError *after* the
  // file has already been written.
  return `✅ Swagger server URL patched to: ${doc.servers?.[0]?.url}`;
}

// Read the committed, pristine contract and emit the patched copy the swagger
// page serves. Source and destination are deliberately different files: the
// server URL is environment-specific (it becomes http://mockoon:8080 inside
// Docker), so patching in place would leave a container hostname in the working
// tree — and eventually in a commit — after every `make start`.
export const CONTRACT_PATH = './contracts/user-service/openapi.json';
export const OUTPUT_PATH = './public/swagger-schema.json';

export function patchSwaggerServer(contractPath = CONTRACT_PATH, outputPath = OUTPUT_PATH) {
  const doc = readSwaggerSchema(contractPath);
  return writeSwaggerSchema(outputPath, patchSwaggerServerUrl(doc, getApiBaseUrl()));
}

// Only patch when run as a script, so the unit suite can import the real
// functions instead of re-implementing them. Matched on argv rather than
// import.meta because Jest transforms this module to CJS, where import.meta is
// not available — the same guard fetchSwaggerSchema.mjs uses.
if (process.argv[1]?.endsWith('patchSwaggerServer.mjs')) {
  console.log(patchSwaggerServer());
}
