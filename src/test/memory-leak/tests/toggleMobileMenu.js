import { t } from 'i18next';
import nextEnv from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';
import '../utils/initializeLocalization.js';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder();

const mobileViewport = { width: 400, height: 812 };

const openMenuLabel = t('header.drawer.button_aria_labels.bars');
const closeMenuLabel = t('header.drawer.button_aria_labels.exit');

const menuIconSelector = `button[aria-label="${openMenuLabel}"]`;
const closeIconSelector = `button[aria-label="${closeMenuLabel}"]`;

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
