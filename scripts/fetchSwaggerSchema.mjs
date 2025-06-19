import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { load } from 'js-yaml';

const swaggerPath = './public/swagger-schema.json';
const version = process.env.USER_SERVICE_SPEC_VERSION;

if (!version) {
  console.error('❌ USER_SERVICE_SPEC_VERSION is not set');
  process.exit(1);
}

export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;
}

export async function fetchSwaggerYaml(url){
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch swagger schema. HTTP status: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

export async function saveSwaggerJson(yamlText, filePath){
  const jsonContent = load(yamlText);
  await writeFile(filePath, JSON.stringify(jsonContent, null, 2));
}


(async () => {
  try {
    const swaggerUrl = buildSpecUrl();
    const swaggerSchema = await fetchSwaggerYaml(swaggerUrl);
    await saveSwaggerJson(swaggerSchema, swaggerPath);
    console.log('✅ Swagger schema saved as JSON');
  } catch (err) {
    console.error('❌ Failed to fetch/save swagger schema:', err);
    process.exit(1);
  }
})();
