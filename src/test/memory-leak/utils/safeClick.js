const winston = require('winston');

async function isElementInteractable(element) {
  const isConnected = await element.evaluate(el => el.isConnected);
  const isVisible = await element.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.pointerEvents !== 'none' &&
      !el.disabled
    );
  });
  return isConnected && isVisible;
}

async function safeClick(element, elementDescription = 'element') {
  if (await isElementInteractable(element)) {
    try {
      await element.click();
      return true;
    } catch (err) {
      const outerHTML = await element.evaluate(el => el.outerHTML);
      winston.error(`Failed to click ${elementDescription}`, {
        element: outerHTML,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
  return false;
}

module.exports = safeClick;
