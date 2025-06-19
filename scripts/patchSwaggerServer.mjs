import 'dotenv/config';
import fs from 'node:fs';

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const schemaPath = './public/swagger-schema.json';

const isDev = process.env.NODE_ENV === 'development';

const mockUrl = ensureEnv(
  isDev ? 'NEXT_PUBLIC_MOCKOON_LOCAL_API_URL' : 'NEXT_PUBLIC_MOCKOON_CONTAINER_API_URL'
);

let content;
let doc;

try {
  content = fs.readFileSync(schemaPath, 'utf8');
  doc = JSON.parse(content);
} catch (error) {
  console.error(`❌ Failed to read or parse swagger schema at "${schemaPath}":`, error.message);
  process.exit(1);
}

if (Array.isArray(doc.servers) && doc.servers.length > 0) {
  doc.servers[0].url = mockUrl;
} else {
  doc.servers = [{ url: mockUrl }];
}

fs.writeFileSync(schemaPath, JSON.stringify(doc, null, 2));
console.log('✅ Swagger server URL patched to:', mockUrl);
