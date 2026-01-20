import ScenarioBuilder from '../utils/ScenarioBuilder.js';
import swipeSlider from '../utils/swipeSlider.js';

const scenarioBuilder = new ScenarioBuilder();

const mobileViewport = { width: 400, height: 812 };

const sliderSelector = '.swiper-wrapper';

const iterations = 6;

async function setup(page) {
  await page.setViewport(mobileViewport);
}

async function action(page) {
  await swipeSlider(page, sliderSelector, iterations, 'left');
}

async function back(page) {
  await swipeSlider(page, sliderSelector, iterations, 'right');
}

export default scenarioBuilder.createScenario({ setup, action, back });
