const ScenarioBuilder = require('../utils/ScenarioBuilder');

const scenarioBuilder = new ScenarioBuilder();

const headerLogoSelector = 'a[aria-label*="logo" i]';

async function action(page) {
  await page.click(headerLogoSelector);
}

async function back(page) {
  await page.goBack();
}

module.exports = scenarioBuilder.createScenario({ action, back });
