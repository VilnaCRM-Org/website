import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import dotenv from 'dotenv';

import { t } from './utils/initializeLocalization';

dotenv.config();

enum SocialNetwork {
  // TODO: correct the url to our social networks
  INSTAGRAM = 'instagram',
  GITHUB = 'github',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
}

const socialLinks: Record<SocialNetwork, { url: string }> = {
  [SocialNetwork.INSTAGRAM]: { url: process.env.INSTAGRAM_URL || 'https://www.instagram.com/' },
  [SocialNetwork.GITHUB]: { url: process.env.GITHUB_URL || 'https://github.com/VilnaCRM-Org/' },
  [SocialNetwork.FACEBOOK]: { url: process.env.FACEBOOK_URL || 'https://www.facebook.com/' },
  [SocialNetwork.LINKEDIN]: { url: process.env.LINKEDIN_URL || 'https://www.linkedin.com/' },
} as const;

const linkToInstagramRole: string = t('header.drawer.aria_labels_social_images.instagram');
const linkToGithubRole: string = t('header.drawer.aria_labels_social_images.github');
const linkToFacebookRole: string = t('header.drawer.aria_labels_social_images.facebook');
const linkToLinkedinRole: string = t('header.drawer.aria_labels_social_images.linkedin');
const buttonToOpenDrawerLabel: string = t('header.drawer.button_aria_labels.bars');

const mockedPageBodyContent: string = 'Mocked Page';

async function mockSocialLinkUrlRoute(page: Page, url: string): Promise<void> {
  const { origin } = new URL(url);
  const pattern: string = `${origin}/**`;
  await page.context().route(pattern, route => {
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
  await expect(socialLink).toBeEnabled();

  const [popup] = await Promise.all([
    page.waitForEvent('popup').catch(() => null),
    socialLink.click(),
  ]);
  if (popup) {
    await expect(popup).toHaveURL(expectedURL);
    await popup.close();
  } else {
    await expect(page).toHaveURL(expectedURL);
  }
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
  const link: Locator = page.getByRole('presentation').getByLabel(linkName);
  await expect(link).toBeVisible();
  await expect(link).toBeEnabled();
  const [popup] = await Promise.all([page.waitForEvent('popup').catch(() => null), link.click()]);
  if (popup) {
    await expect(popup).toHaveURL(expectedURL);
    await popup.close();
  } else {
    await expect(page).toHaveURL(expectedURL);
  }
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
    await navigateAndVerifyURL(page, linkToLinkedinRole, /linkedin/, socialLinks.linkedin.url);
  });
  test('Mobile Linkedin link', async ({ page }) => {
    await openDrawerAndNavigate(page, linkToLinkedinRole, /linkedin/, socialLinks.linkedin.url);
  });
});
