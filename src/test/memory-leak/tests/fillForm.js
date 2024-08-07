const { faker } = require('@faker-js/faker');

const ScenarioBuilder = require('../utils/ScenarioBuilder');

const scenarioBuilder = new ScenarioBuilder();

const fullNameInputSelector = 'input[placeholder="Mykhailo Svitskyi"]';
const emailInputSelector = 'input[placeholder="vilnaCRM@gmail.com"]';
const passwordInputSelector = 'input[placeholder="Create a password"]';
const privacyCheckboxSelector = 'input[type="checkbox"]';

const fakeFullName = faker.person.fullName();
const fakeEmail = faker.internet.email();
const fakePassword = faker.internet.password();

const clickSettings = { clickCount: 3 };

const backspace = 'Backspace';

async function action(page) {
  await page.type(fullNameInputSelector, fakeFullName);
  await page.type(emailInputSelector, fakeEmail);
  await page.type(passwordInputSelector, fakePassword);
  await page.click(privacyCheckboxSelector);
}

async function back(page) {
  const fullNameInput = await page.$(fullNameInputSelector);
  const emailInput = await page.$(emailInputSelector);
  const passwordInput = await page.$(passwordInputSelector);

  await fullNameInput.click(clickSettings);
  await page.keyboard.press(backspace);

  await emailInput.click(clickSettings);
  await page.keyboard.press(backspace);

  await passwordInput.click(clickSettings);
  await page.keyboard.press(backspace);

  await page.click(privacyCheckboxSelector);
}

module.exports = scenarioBuilder.createScenario({ action, back });
