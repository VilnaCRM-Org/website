import { faker } from '@faker-js/faker';
import { t } from 'i18next';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';

const scenarioBuilder = new ScenarioBuilder();

const createInputSelector = placeholder => `input[placeholder="${placeholder}"]`;

const fullNamePlaceholder = t('sign_up.form.name_input.placeholder');
const emailPlaceholder = t('sign_up.form.email_input.placeholder');
const passwordPlaceholder = t('sign_up.form.password_input.placeholder');

const fullNameInputSelector = createInputSelector(fullNamePlaceholder);
const emailInputSelector = createInputSelector(emailPlaceholder);
const passwordInputSelector = createInputSelector(passwordPlaceholder);
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

export default scenarioBuilder.createScenario({ action, back });
