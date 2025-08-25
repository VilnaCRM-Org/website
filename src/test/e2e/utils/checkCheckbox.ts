import { Locator, expect } from '@playwright/test';

 async function checkCheckbox(checkbox: Locator): Promise<void> {
  await checkbox.check();
  expect(checkbox).toBeChecked();
}
export default checkCheckbox;