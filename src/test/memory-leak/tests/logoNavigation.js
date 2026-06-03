import i18n from 'i18next';
import nextEnv from '@next/env';
import ScenarioBuilder from '../utils/ScenarioBuilder.js';
import '../utils/initializeLocalization.js';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const scenarioBuilder = new ScenarioBuilder('swagger');

const headerLogoLabels = Array.from(
  new Set(
    [process.env.NEXT_PUBLIC_MAIN_LANGUAGE, process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE]
      .filter(Boolean)
      .map(locale => i18n.getFixedT(locale)('header.logo_alt'))
      .filter(Boolean)
  )
);

if (headerLogoLabels.length === 0) {
  throw new Error('Failed to resolve header logo labels from i18n translations.');
}

const headerLogoSelectors = [
  'header a[href="/"]',
  'header a[aria-label*="logo" i]',
  ...headerLogoLabels.flatMap(label => [
    `header a[aria-label="${label}"]`,
    `header a img[alt="${label}"]`,
  ]),
].join(', ');

async function getHeaderLogoLink(page) {
  const logoElement = await page.waitForSelector(headerLogoSelectors, { visible: true });

  if (!logoElement) {
    throw new Error('Header logo element not found.');
  }

  const logoHandle = logoElement.asElement();

  if (!logoHandle) {
    throw new Error('Header logo element handle not found.');
  }

  const isAnchor = await logoHandle.evaluate(el => el.tagName.toLowerCase() === 'a');

  if (isAnchor) {
    return logoHandle;
  }

  const logoLinkHandle = await logoHandle.evaluateHandle(image => image.closest('a'));
  const logoLink = logoLinkHandle.asElement();

  if (!logoLink) {
    throw new Error('Header logo link not found.');
  }

  return logoLink;
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function waitForPath(page, expectedPath) {
  if (typeof page.waitForFunction === 'function') {
    return page
      .waitForFunction(path => window.location.pathname === path, expectedPath, { timeout: 5000 })
      .catch(() => null);
  }

  if (typeof page.waitForNavigation === 'function') {
    return page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => null);
  }

  return Promise.resolve(null);
}

async function action(page) {
  const logoLink = await getHeaderLogoLink(page);
  const maybePathChange = waitForPath(page, '/');

  await Promise.all([maybePathChange, logoLink.click()]);
  await delay(500);
}

async function back(page) {
  const maybePathChange = waitForPath(page, '/swagger');

  await Promise.all([maybePathChange, page.goBack().catch(() => null)]);
  await delay(500);
}

export default scenarioBuilder.createScenario({ action, back });
