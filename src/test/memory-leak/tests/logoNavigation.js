const { t } = require('i18next');

const ScenarioBuilder = require('../utils/ScenarioBuilder');

const scenarioBuilder = new ScenarioBuilder();

const headerLogoLabels = [t('header.logo_alt'), 'Vilna логотип', 'Vilna logo'];
const headerLogoSelector = headerLogoLabels
  .flatMap(label => [`header a[aria-label="${label}"]`, `a[aria-label="${label}"]`])
  .join(', ');

async function action(page) {
  await page.waitForSelector(headerLogoSelector, { visible: true });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click(headerLogoSelector),
  ]);
}

async function back(page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.goBack(),
  ]);
}

module.exports = scenarioBuilder.createScenario({ action, back });
