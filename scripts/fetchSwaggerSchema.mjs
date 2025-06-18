import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const version = process.env.USER_SERVICE_SPEC_VERSION;

if (!version) {
  console.error('❌ USER_SERVICE_SPEC_VERSION is not set');
  process.exit(1);
}

const specUrl = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;
console.log('specUrl:', specUrl);


async function fetchAndSaveSwagger() {
 try {
   const response = await fetch(specUrl);

   if (!response.ok) {
     throw new Error(`Failed to fetch swagger schema. HTTP status: ${response.status} ${response.statusText}`);
   }

   const yamlText = await response.text();
   const jsonContent = yaml.load(yamlText);

   await writeFile('./public/swagger-schema.json', JSON.stringify(jsonContent, null, 2));

   console.log('✅ Swagger schema saved as JSON');
 }catch (error) {
   console.error('❌ Error fetching swagger schema:', error);
   process.exit(1);
 }
}
fetchAndSaveSwagger()