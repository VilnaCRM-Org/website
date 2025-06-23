import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { load } from 'js-yaml';

const swaggerPath = './public/swagger-schema.json';
const version = process.env.USER_SERVICE_SPEC_VERSION || 'v2.6.0';

export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;
}

export async function fetchSwaggerYaml(url){
  if (!url || typeof url !== 'string') {
     throw new Error('URL parameter is required and must be a string');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch swagger schema. HTTP status: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

export async function saveSwaggerJson(yamlText, filePath){
  if (!yamlText || typeof yamlText !== 'string') {
    throw new Error('yamlText parameter is required and must be a string');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath parameter is required and must be a string');
  }
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
