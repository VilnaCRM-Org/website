import { loadEnvConfig } from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';

loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder();

const servicesButtonSelector = 'p#services-label > span';
const tooltipSelector = '.MuiTooltip-popper';

const coordinateX = 100;
const coordinateY = 100;

async function action(page) {
  await page.click(servicesButtonSelector);

  await page.waitForSelector(tooltipSelector, { visible: true });
}

async function back(page) {
  await page.mouse.click(coordinateX, coordinateY);

  await page.waitForSelector(tooltipSelector, { hidden: true });
}

export default scenarioBuilder.createScenario({ action, back });
