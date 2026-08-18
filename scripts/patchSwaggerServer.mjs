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

/**
 * Replaces `servers` wholesale with the single build-controlled entry.
 *
 * Overriding only `servers[0]` (the previous behaviour) let every other entry in
 * the vendored document survive into `public/swagger-schema.json`, where the
 * swagger "Try it out" console offers them in its server dropdown. An extra
 * `servers[1]` pointing at an attacker origin is therefore one click away from
 * receiving a token a user types into the live API console. The build knows
 * exactly one correct origin, so the array is rebuilt rather than patched.
 */
export function patchSwaggerServerUrl(doc, url) {
  return { ...doc, servers: [{ url }] };
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
