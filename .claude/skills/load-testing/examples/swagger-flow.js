// Trimmed config-driven API scenario. Mirrors the pattern of src/test/load/swagger.js:
// load the page, then exercise the mock REST API with per-VU test data and check each
// response. The full scenario also covers auth, error cases, batches, and query params.
import http from 'k6/http';
import { sleep } from 'k6';

import ScenarioUtils from './utils/scenarioUtils.js';
import Utils from './utils/utils.js';
import TEST_DATA_GENERATORS from './utils/test-data.js';

const scenarioName = 'swagger';

const utils = new Utils();
const scenarioUtils = new ScenarioUtils(utils, scenarioName);

export const options = scenarioUtils.getOptions();

export default function swagger() {
  const baseUrl = utils.getBaseUrl();
  const params = utils.getParams();
  const user = TEST_DATA_GENERATORS.generateUser();

  const page = http.get(`${baseUrl}/swagger`, params);
  utils.checkResponse(page, 'swagger page loads', res => res.status === 200);

  const created = http.post(`${baseUrl}/api/users`, JSON.stringify(user), params);
  utils.checkResponse(created, 'create responds 201', res => res.status === 201);

  const userId = created.json('id');
  const fetched = http.get(`${baseUrl}/api/users/${userId}`, params);
  utils.checkResponse(fetched, 'get responds 200', res => res.status === 200);

  sleep(1);
}
