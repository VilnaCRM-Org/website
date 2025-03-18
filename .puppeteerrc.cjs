const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
const puppeteer = require('puppeteer-core');

loadEnvConfig(projectDir);

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
    await page.goto('https://prod:3001');
    console.log('Page loaded');
  } catch(error){
    console.error('Navigation failed:', error);
    process.exit(1);
  }finally {
    await browser.close();
  }
})();
