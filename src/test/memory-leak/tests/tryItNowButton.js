import { loadEnvConfig } from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';

loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder();

const signUpButtonSelector = 'a[href="#signUp"]';

const coordinateX = 0;
const coordinateY = 0;

async function action(page) {
  await page.click(signUpButtonSelector);
}

async function back(page) {
  await page.evaluate(
    (x, y) => {
      window.scrollTo(x, y);
    },
    coordinateX,
    coordinateY
  );
}

export default scenarioBuilder.createScenario({ action, back });
