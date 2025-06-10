import 'dotenv/config';
import fs from 'node:fs';
import YAML from 'js-yaml';

const path = './public/swagger-schema.yaml';
const mockUrl = `http://${process.env.WEBSITE_DOMAIN}:${process.env.MOCKOON_PORT}`;

const content = fs.readFileSync(path, 'utf8');
const doc = YAML.load(content);

if (Array.isArray(doc.servers) && doc.servers.length > 0) {
  doc.servers[0].url = mockUrl;
} else {
  doc.servers = [{ url: mockUrl }];
}

fs.writeFileSync(path, YAML.dump(doc));
console.log('Swagger server URL patched to:', mockUrl);
