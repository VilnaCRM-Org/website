import nextEnv from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder();

const advantagesLinkSelector = 'a[href="#Advantages"]';
const forWhoSectionLinkSelector = 'a[href="#forWhoSection"]';
const integrationLinkSelector = 'a[href="#Integration"]';
const contactsLinkSelector = 'a[href="#Contacts"]';

const coordinateX = 0;
const coordinateY = 0;

async function action(page) {
  await page.click(advantagesLinkSelector);
  await page.click(forWhoSectionLinkSelector);
  await page.click(integrationLinkSelector);
  await page.click(contactsLinkSelector);
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
