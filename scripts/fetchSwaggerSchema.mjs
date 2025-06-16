import 'dotenv/config';
import { writeFile } from 'fs/promises';
import yaml from 'js-yaml';

const version = process.env.USER_SERVICE_SPEC_VERSION;
const specUrl = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;

if (!version) {
  console.log('specUrl:', specUrl);
  console.error('❌ USER_SERVICE_SPEC_VERSION is not set');
  process.exit(1);
}

async function fetchAndSaveSwagger() {
 try {
   const response = await fetch(specUrl);

   if (!response.ok) {
     throw new Error(`Failed to fetch swagger schema. HTTP status: ${res.status} ${res.statusText}`);
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