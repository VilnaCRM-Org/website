const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
const puppeteer = require('puppeteer-core');


const { combinedEnv, loadedEnvFiles } = loadEnvConfig(
  projectDir,
  process.env.NODE_ENV || 'production',
  { info: console.log, error: console.error }
);
console.log(`Loaded ${loadedEnvFiles.length} environment file(s)`);

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

  let page;
  try {
    page = await browser.newPage();
    const targetUrl = process.env.NEXT_PUBLIC_PROD_CONTAINER_API_URL || 'http://prod:3001';

    await page.goto(targetUrl);
    console.log(`Page loaded successfully: ${targetUrl}`);
  } catch (error) {
    console.error('Navigation failed:', error);
    try {
      if (page) {
        await page.screenshot({ path: 'error-screenshot.png' });
        console.log('Error screenshot saved to error-screenshot.png');
      } else {
        console.error('Cannot take screenshot: page not initialized');
      }
    } catch (screenshotError) {
      console.error('Failed to capture error screenshot:', screenshotError);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
