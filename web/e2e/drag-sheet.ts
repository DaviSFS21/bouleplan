import type { Locator, Page } from '@playwright/test';

export async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Expected the element to have a box.');
  return found;
}

// Presses the handle, drags it down by `distance` pixels in steps and lets go.
export async function dragDown(page: Page, handle: Locator, distance: number) {
  const area = await box(handle);
  const x = area.x + area.width / 2;
  const y = area.y + area.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(x, y + (distance * step) / 6);
  }
  await page.mouse.up();
}
