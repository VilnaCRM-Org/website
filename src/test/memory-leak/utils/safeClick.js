const winston = require('winston');

async function isElementInteractable(element) {
  return element.evaluate(el => {
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.pointerEvents !== 'none' &&
      !el.disabled &&
      style.opacity !== '0'
    );
  });
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
      return false;
    }
  }
  return false;
}

module.exports = safeClick;
