import 'dotenv/config';
import fs from 'node:fs';
import YAML from 'js-yaml';

const version = process.env.USER_SERVICE_SPEC_VERSION;
const specUrl = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;

if (!specUrl) {
  console.log('specUrl',specUrl);
  console.error('❌ NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL is not set');
  process.exit(1);
}

async function fetchAndSaveSwagger() {
  try {
    const res = await fetch(specUrl);

    if (!res.ok) {
      throw new Error(`Failed to fetch swagger schema. HTTP status: ${res.status} ${res.statusText}`);
    }

    const yamlText = await res.text();
    const parsed = YAML.load(yamlText);

        fs.writeFileSync('./public/swagger-schema.yaml', YAML.dump(parsed));

    console.log('✅ Swagger schema saved as YAML.');
  } catch (error) {
    console.error('❌ Error fetching swagger schema:', error);
    process.exit(1);
  }
}

fetchAndSaveSwagger();