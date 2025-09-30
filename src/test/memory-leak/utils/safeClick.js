const winston = require('winston');

async function isElementInteractable(element) {
  const isConnected = await element.evaluate(el => el.isConnected);
  const isVisible = await element.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  });
  return isConnected && isVisible;
}

async function safeClick(element, elementDescription = 'element') {
  if (await isElementInteractable(element)) {
    try {
      await element.click();
      return true;
    } catch (err) {
      winston.error(
        `Failed to click ${elementDescription}:`,
        await element.evaluate(el => el.outerHTML),
        err
      );
      return false;
    }
  }
  return false;
}

module.exports = safeClick;
