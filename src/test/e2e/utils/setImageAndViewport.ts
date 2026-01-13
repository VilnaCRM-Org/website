import { expect, Locator, Page } from '@playwright/test';

import { NullableImgSize } from '../types/device-image';

export async function setImageAndViewport(
  page: Page,
  width: number,
  height: number
): Promise<NullableImgSize> {
  await page.setViewportSize({ width, height });
  const image: Locator = page.getByRole('img', { name: 'Main image' });
  await expect(image).toBeVisible();
  const imageHandle = await image.elementHandle();
  if (!imageHandle) {
    throw new Error('Main image element was not found.');
  }
  await page.waitForFunction(
    (el: Element) =>
      el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0,
    imageHandle
  );
  await page.waitForFunction(
    (el: Element) => {
      if (!(el instanceof HTMLImageElement)) {
        return false;
      }
      const rect: DOMRect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
    imageHandle
  );
  return image.boundingBox();
}
