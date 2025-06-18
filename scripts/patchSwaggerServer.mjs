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

const isDev = process.env.NODE_ENV === 'development';

const path = './public/swagger-schema.json';
const mockUrl = isDev
  ? `http://${ensureEnv('WEBSITE_DOMAIN')}:${ensureEnv('MOCKOON_PORT')}`
  : `http://${ensureEnv('MOCKOON_API_PATH')}:${ensureEnv('MOCKOON_PORT')}`;

const content = fs.readFileSync(path, 'utf8');
const doc = JSON.parse(content);

if (Array.isArray(doc.servers) && doc.servers.length > 0) {
  doc.servers[0].url = mockUrl;
} else {
  doc.servers = [{ url: mockUrl }];
}

fs.writeFileSync(path, JSON.stringify(doc, null, 2));
console.log('✅ Swagger server URL patched to:', mockUrl);
