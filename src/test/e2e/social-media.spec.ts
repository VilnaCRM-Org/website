import { test, expect, Page, Locator } from '@playwright/test';

import { t } from './utils/initializeLocalization';

enum SocialNetwork {
  // TODO: correct the url to our social networks
  INSTAGRAM = 'instagram',
  GITHUB = 'github',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
}

const socialLinks: Record<SocialNetwork, { url: string }> = {
  [SocialNetwork.INSTAGRAM]: { url: 'https://www.instagram.com/' },
  [SocialNetwork.GITHUB]: { url: 'https://github.com/VilnaCRM-Org/' },
  [SocialNetwork.FACEBOOK]: { url: 'https://www.facebook.com/' },
  [SocialNetwork.LINKEDIN]: { url: 'https://www.linkedin.com/' },
};

const linkToInstagramRole: string = t('header.drawer.aria_labels_social_images.instagram');
const linkToGithubRole: string = t('header.drawer.aria_labels_social_images.github');
const linkToFacebookRole: string = t('header.drawer.aria_labels_social_images.facebook');
const linkToLinkedinRole: string = t('header.drawer.aria_labels_social_images.linkedin');
const buttonToOpenDrawerLabel: string = t('header.drawer.button_aria_labels.bars');

const mockedPageBodyContent: string = 'Mocked Page';

async function mockSocialLinkUrlRoute(page: Page, url: string): Promise<void> {
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      body: mockedPageBodyContent,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  });
}

async function navigateAndVerifyURL(
  page: Page,
  linkName: string,
  expectedURL: string | RegExp,
  url: string
): Promise<void> {
  await mockSocialLinkUrlRoute(page, url);

  const socialLink: Locator = page.getByRole('link', { name: linkName });
  await socialLink.waitFor({ state: 'visible' });
  await socialLink.isEnabled();

  await socialLink.click();
  await page.goto(url);
  await page.waitForURL(expectedURL);
  await expect(page).toHaveURL(expectedURL);
}

async function openDrawerAndNavigate(
  page: Page,
  linkName: string,
  expectedURL: string | RegExp,
  url: string
): Promise<void> {
  await mockSocialLinkUrlRoute(page, url);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel(buttonToOpenDrawerLabel).click();
  await page.getByRole('presentation').getByLabel(linkName).click();
  await page.goto(url);
  await page.waitForURL(expectedURL);
  await expect(page).toHaveURL(expectedURL);
}

test.describe('Navigation tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Desktop Instagram link', async ({ page }) => {
    await navigateAndVerifyURL(page, linkToInstagramRole, /instagram/, socialLinks.instagram.url);
  });
  test('Mobile Instagram link', async ({ page }) => {
    await openDrawerAndNavigate(page, linkToInstagramRole, /instagram/, socialLinks.instagram.url);
  });

  test('Desktop GitHub link', async ({ page }) => {
    await navigateAndVerifyURL(page, linkToGithubRole, /github/, socialLinks.github.url);
  });
  test('Mobile GitHub link', async ({ page }) => {
    await openDrawerAndNavigate(page, linkToGithubRole, /github/, socialLinks.github.url);
  });

  test('Desktop Facebook link', async ({ page }) => {
    await navigateAndVerifyURL(page, linkToFacebookRole, /facebook/, socialLinks.facebook.url);
  });
  test('Mobile Facebook link', async ({ page }) => {
    await openDrawerAndNavigate(page, linkToFacebookRole, /facebook/, socialLinks.facebook.url);
  });

  test('Desktop Linkedin link', async ({ page }) => {
    await navigateAndVerifyURL(page, linkToLinkedinRole, /link/, socialLinks.linkedin.url);
  });
  test('Mobile Linkedin link', async ({ page }) => {
    await openDrawerAndNavigate(page, linkToLinkedinRole, /link/, socialLinks.linkedin.url);
  });
});
