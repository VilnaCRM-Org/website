
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin());
(async () => {
    const browser = await puppeteer.launch({
        headless:false, executablePath: '/usr/bin/chromium' ,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
     console.log("Chromium launched successfully!");
    await browser.close();
})();