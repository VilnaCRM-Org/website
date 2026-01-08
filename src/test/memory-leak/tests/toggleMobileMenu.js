import { t } from 'i18next';
import { loadEnvConfig } from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';
import '../utils/initializeLocalization.js';

loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder();

const mobileViewport = { width: 400, height: 812 };

const barsIconAlt = t('header.drawer.image_alt.bars');
const exitIconAlt = t('header.drawer.image_alt.exit');

const menuIconSelector = `img[alt="${barsIconAlt}"]`;
const closeIconSelector = `img[alt="${exitIconAlt}"]`;

async function setup(page) {
  await page.setViewport(mobileViewport);
}

async function action(page) {
  await page.click(menuIconSelector);

  await page.waitForSelector(closeIconSelector, { visible: true });
}

async function back(page) {
  await page.click(closeIconSelector);

  await page.waitForSelector(closeIconSelector, { hidden: true });
}

export default scenarioBuilder.createScenario({ setup, action, back });
