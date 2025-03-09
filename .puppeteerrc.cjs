const puppeteer = require('puppeteer-extra');
const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

loadEnvConfig(projectDir);
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--disable-dev-shm-usage',
      '--user-data-dir=/root/.config/chromium/docker-chromium-profile',
      '--no-zygote',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://prod:3000');
    console.log('Page loaded');
  } finally {
    await browser.close();
  }
})();
