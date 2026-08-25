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
    // `process.exit` never returns, but returning its (never produced) value
    // keeps every path of this function an explicit `return` rather than an
    // implicit `undefined` fall-through.
    return process.exit(1);
  }
}

// The only positions swagger-ui reads a server list from, per the OpenAPI spec:
// the document root, a Path Item, and an Operation.
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

const isPlainObject = node => Boolean(node) && typeof node === 'object' && !Array.isArray(node);

const withoutServers = node =>
  Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'servers'));

// `x-` means "specification extension" only inside an OpenAPI *Object* that
// declares extension support — the Paths Object and a Callback Object. It does
// NOT mean that in a map whose keys are user-chosen identifiers: a component
// name matches `^[a-zA-Z0-9._-]+$`, so `x-foo` is a perfectly legal name for a
// reusable Path Item, and skipping it would leave a `$ref`-able override intact.
const isExtension = key => key.startsWith('x-');

// Keys are paths or runtime expressions, alongside `x-` extensions.
const EXTENSION_MAP = 'extensionMap';
// Keys are user-chosen names (webhooks, components.pathItems); no extensions.
const NAME_MAP = 'nameMap';
// Keys are user-chosen names whose values are Callback Objects.
const CALLBACK_NAME_MAP = 'callbackNameMap';
const PATH_ITEM = 'pathItem';
const OPERATION = 'operation';

const mapValues = (node, fn) =>
  Object.fromEntries(Object.entries(node).map(([key, value]) => [key, fn(key, value)]));

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
 * `kind` says what the node IS, so the walk removes `servers` exactly where
 * OpenAPI defines one and nowhere else. A blanket filter over every key named
 * `servers` also deleted a schema property and an example payload field that
 * merely happened to be called `servers`, silently changing the document.
 *
 * One self-recursive function rather than mutually recursive helpers or a table
 * of per-kind strippers: a Callback Object maps a runtime expression to a Path
 * Item whose operations may declare further callbacks, so that cycle has no
 * valid declaration order — anything lifted out of this body would have to be
 * referenced before it is defined.
 *
 * The kinds are therefore selected through one `if`/`else` chain that assigns
 * the rebuilt node and falls through to a single `return`, rather than through a
 * run of early exits. `OPERATION` is the trailing `else` because it is what a
 * node with no more specific kind is: the last branch of the previous early-exit
 * form, unchanged.
 */
function stripServers(node, kind) {
  let stripped;

  if (!isPlainObject(node)) {
    stripped = node;
  } else if (kind === EXTENSION_MAP) {
    stripped = mapValues(node, (key, value) =>
      isExtension(key) ? value : stripServers(value, PATH_ITEM)
    );
  } else if (kind === NAME_MAP) {
    stripped = mapValues(node, (_key, value) => stripServers(value, PATH_ITEM));
  } else if (kind === CALLBACK_NAME_MAP) {
    stripped = mapValues(node, (_key, value) => stripServers(value, EXTENSION_MAP));
  } else if (kind === PATH_ITEM) {
    stripped = mapValues(withoutServers(node), (key, value) =>
      HTTP_METHODS.has(key.toLowerCase()) ? stripServers(value, OPERATION) : value
    );
  } else {
    const operation = withoutServers(node);
    stripped = isPlainObject(operation.callbacks)
      ? { ...operation, callbacks: stripServers(operation.callbacks, CALLBACK_NAME_MAP) }
      : operation;
  }

  return stripped;
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
    patched.paths = stripServers(patched.paths, EXTENSION_MAP);
  }
  if (isPlainObject(patched.webhooks)) {
    patched.webhooks = stripServers(patched.webhooks, NAME_MAP);
  }
  if (isPlainObject(patched.components)) {
    const components = { ...patched.components };

    if (isPlainObject(components.pathItems)) {
      components.pathItems = stripServers(components.pathItems, NAME_MAP);
    }
    if (isPlainObject(components.callbacks)) {
      components.callbacks = stripServers(components.callbacks, CALLBACK_NAME_MAP);
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
