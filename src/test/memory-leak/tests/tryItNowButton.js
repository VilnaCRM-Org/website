const ScenarioBuilder = require('../utils/ScenarioBuilder');

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

module.exports = scenarioBuilder.createScenario({ action, back });
