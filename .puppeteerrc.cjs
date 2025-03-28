const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
const puppeteer = require('puppeteer-core');

loadEnvConfig(projectDir, process.env.PROD_NODE_ENV || 'production');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox', // Required for running in Docker, disables Chrome sandbox
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
    const targetUrl = process.env.NEXT_PUBLIC_PROD_CONTAINER_API_URL || 'http://prod:3001';

    await page.goto('http://prod:3001');
    console.log(`Page loaded successfully: ${targetUrl}`);
  } catch (error) {
    console.error('Navigation failed:', error);
    try {
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('Error screenshot saved to error-screenshot.png');
    } catch (screenshotError) {
      console.error('Failed to capture error screenshot:', screenshotError);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
