import { expect, type Locator, type Page } from '@playwright/test';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// Opens the calendar of a trigger, walks to the month of the day with the keyboard and clicks it.
export async function pickDate(page: Page, trigger: Locator, iso: string) {
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /^Escolher / });
  await expect(dialog).toBeVisible();
  const [shownMonth = '', shownYear = '0'] = (
    (await dialog.getByRole('status').textContent()) ?? ''
  )
    .trim()
    .split(' ');
  const [year = 0, month = 1] = iso.split('-').map(Number);
  const gap = (year - Number(shownYear)) * 12 + (month - 1 - MONTHS.indexOf(shownMonth));
  const years = Math.trunc(gap / 12);
  const months = gap % 12;
  for (let step = 0; step < Math.abs(years); step += 1) {
    await page.keyboard.press(years > 0 ? 'Shift+PageDown' : 'Shift+PageUp');
  }
  for (let step = 0; step < Math.abs(months); step += 1) {
    await page.keyboard.press(months > 0 ? 'PageDown' : 'PageUp');
  }
  await dialog.locator(`td[data-day="${iso}"] button`).click();
  await expect(dialog).toHaveCount(0);
}
