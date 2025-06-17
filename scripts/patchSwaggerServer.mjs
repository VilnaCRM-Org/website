import 'dotenv/config';
import fs from 'node:fs';
import YAML from 'js-yaml';

const path = './public/swagger-schema.json';
const mockUrl = process.env.NODE_ENV === 'development'
  ? `http://${process.env.WEBSITE_DOMAIN}:${process.env.MOCKOON_PORT}`
  : `http://${process.env.MOCKOON_API_PATH}:${process.env.MOCKOON_PORT}`;

const content = fs.readFileSync(path, 'utf8');
const doc = YAML.load(content);

if (Array.isArray(doc.servers) && doc.servers.length > 0) {
  doc.servers[0].url = mockUrl;
} else {
  doc.servers = [{ url: mockUrl }];
}

fs.writeFileSync('./public/swagger-schema.json', JSON.stringify(doc, null, 2));
console.log('Swagger server URL patched to:', mockUrl);
