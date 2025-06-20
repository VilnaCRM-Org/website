import 'dotenv/config';
import fs from 'node:fs';
import dotenvExpand from 'dotenv-expand';
import dotenv from 'dotenv';


const env = dotenv.config();
dotenvExpand.expand(env);

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function getMockUrl() {
  const isDev = process.env.NODE_ENV === 'development';
  return ensureEnv(
    isDev ? 'NEXT_PUBLIC_MOCKOON_LOCAL_API_URL' : 'NEXT_PUBLIC_MOCKOON_CONTAINER_API_URL'
  );
}

function readSwaggerSchema(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read or parse swagger schema at "${path}":`, error.message);
    process.exit(1);
  }
}

function patchSwaggerServerUrl(doc, url) {
  const patchedDoc = { ...doc };

  if (Array.isArray(patchedDoc.servers) && patchedDoc.servers.length > 0) {
    patchedDoc.servers = [...patchedDoc.servers];
    patchedDoc.servers[0] = { ...patchedDoc.servers[0], url };
  } else {
    patchedDoc.servers = [{ url }];
  }

  return patchedDoc;
}

function writeSwaggerSchema(path, doc) {
  fs.writeFileSync(path, JSON.stringify(doc, null, 2));
  return `✅ Swagger server URL patched to: ${doc.servers[0].url}`;
}

const schemaPath = './public/swagger-schema.json';
const mockUrl = getMockUrl();
const doc = readSwaggerSchema(schemaPath);
const updatedDoc = patchSwaggerServerUrl(doc, mockUrl);
writeSwaggerSchema(schemaPath, updatedDoc);