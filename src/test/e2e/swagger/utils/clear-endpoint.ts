import { Locator, expect } from '@playwright/test';

async function clearEndpoint(endpoint: Locator): Promise<void> {
  const clearButton: Locator = endpoint.locator('button.btn-clear');
  const curl: Locator = endpoint.locator('.curl-command');

  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(curl).not.toBeVisible();
}

export default clearEndpoint;
