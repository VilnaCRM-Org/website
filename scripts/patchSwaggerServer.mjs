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

// A specification extension is arbitrary user data, never a Path Item, so the
// walk passes it through untouched — an `x-` entry holding its own `servers`
// field is not a server override.
const isExtension = key => key.startsWith('x-');

const PATH_ITEM_CONTAINER = 'container';
const PATH_ITEM = 'pathItem';
const OPERATION = 'operation';

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
 * `kind` says what the node IS, so the walk only removes `servers` where OpenAPI
 * actually defines one. A blanket recursive filter over every key named `servers`
 * also deleted a schema property and an example payload field that merely happened
 * to be called `servers`, silently changing the vendored document.
 *
 * One self-recursive function rather than a set of mutually recursive helpers:
 * a Callback Object maps a runtime expression to a Path Item, whose operations
 * may declare further callbacks, so the cycle has no valid declaration order.
 */
function stripServers(node, kind) {
  if (!isPlainObject(node)) {
    return node;
  }

  if (kind === PATH_ITEM_CONTAINER) {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) =>
        isExtension(key) ? [key, value] : [key, stripServers(value, PATH_ITEM)]
      )
    );
  }

  if (kind === PATH_ITEM) {
    return Object.fromEntries(
      Object.entries(withoutServers(node)).map(([key, value]) =>
        HTTP_METHODS.has(key.toLowerCase()) ? [key, stripServers(value, OPERATION)] : [key, value]
      )
    );
  }

  const operation = withoutServers(node);
  if (!isPlainObject(operation.callbacks)) {
    return operation;
  }
  return {
    ...operation,
    callbacks: Object.fromEntries(
      Object.entries(operation.callbacks).map(([name, callback]) =>
        isExtension(name) ? [name, callback] : [name, stripServers(callback, PATH_ITEM_CONTAINER)]
      )
    ),
  };
}

const stripCallbackMap = callbacks =>
  Object.fromEntries(
    Object.entries(callbacks).map(([name, callback]) =>
      isExtension(name) ? [name, callback] : [name, stripServers(callback, PATH_ITEM_CONTAINER)]
    )
  );

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
    patched.paths = stripServers(patched.paths, PATH_ITEM_CONTAINER);
  }
  if (isPlainObject(patched.webhooks)) {
    patched.webhooks = stripServers(patched.webhooks, PATH_ITEM_CONTAINER);
  }
  if (isPlainObject(patched.components)) {
    const components = { ...patched.components };

    if (isPlainObject(components.pathItems)) {
      components.pathItems = stripServers(components.pathItems, PATH_ITEM_CONTAINER);
    }
    if (isPlainObject(components.callbacks)) {
      components.callbacks = stripCallbackMap(components.callbacks);
    }
    patched.components = components;
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
