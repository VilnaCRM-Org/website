// Example of src/test/load/homepage.js — a minimal, config-driven page-load scenario.
// Copy it under src/test/load/ to run: the ./utils/* imports resolve from there
// (src/test/load/utils/), and options come from config.json via ScenarioUtils.
import http from 'k6/http';

import ScenarioUtils from './utils/scenarioUtils.js';
import Utils from './utils/utils.js';

const scenarioName = 'homepage';

const utils = new Utils();
const scenarioUtils = new ScenarioUtils(utils, scenarioName);

export const options = scenarioUtils.getOptions();

export default function homepage() {
  const response = http.get(utils.getBaseUrl(), utils.getParams());

  utils.checkResponse(response, 'is status 200', res => res.status === 200);
}
