import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedInitiative, type World } from './api-seed';
import { dragDown } from './drag-sheet';
import { resetDatabase } from './reset-database';

const NOW = '2026-11-20T10:30:00-03:00';
const PHONE = { width: 390, height: 844 };

test.use({ timezoneId: 'America/Sao_Paulo' });

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.clock.setFixedTime(new Date(NOW));
});

async function seedBoard(page: Page): Promise<World> {
  return seedInitiative(page.request, 'Reforma', [
    { title: 'Comprar tinta', changes: { priority: 'P1' } },
    { title: 'Lixar parede', changes: { status: 'in_progress' } },
  ]);
}

function card(page: Page, title: string): Locator {
  return page.getByRole('article', { name: title, exact: true });
}

// Waits until no animation is left running, instead of a fixed pause.
async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

test.describe('the initiative sheet with a description being typed, on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  async function typeDescription(page: Page) {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&detalhes=1`);
    const sheet = page.getByRole('dialog', { name: 'Iniciativa', exact: true });
    await sheet
      .getByRole('textbox', { name: 'Descrição', exact: true })
      .fill('Pintar tudo em dezembro');
    return { sheet, url: `/?iniciativa=${initiativeId}&detalhes=1` };
  }

  test('keeps it when the veil is tapped', async ({ page }) => {
    const { sheet, url } = await typeDescription(page);

    await page.touchscreen.tap(195, 20);
    await expect(sheet).toHaveCount(0);

    await page.goto(url);
    await expect(page.getByRole('textbox', { name: 'Descrição', exact: true })).toHaveValue(
      'Pintar tudo em dezembro',
    );
  });

  test('keeps it when the handle is dragged down', async ({ page }) => {
    const { sheet, url } = await typeDescription(page);

    await dragDown(page, sheet.locator('[data-sheet-handle]'), 260);
    await expect(sheet).toHaveCount(0);

    await page.goto(url);
    await expect(page.getByRole('textbox', { name: 'Descrição', exact: true })).toHaveValue(
      'Pintar tudo em dezembro',
    );
  });
});

test.describe('a calendar sheet inside the task sheet, on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test('takes the arrow keys at once, closes alone on Escape and returns focus to "Prazo"', async ({
    page,
  }) => {
    const { initiativeId, taskIds } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds['Lixar parede'] ?? ''}`);
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    const trigger = panel.getByRole('button', { name: /^Prazo:/ });
    await trigger.tap();
    const picker = page.getByRole('dialog', { name: 'Escolher prazo', exact: true });
    await expect(picker).toBeVisible();
    await settled(page);

    const day = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    const first = await day();
    await page.keyboard.press('ArrowRight');
    const second = await day();
    expect(first).toMatch(/de novembro/);
    expect(second).not.toBe(first);
    await expect(picker.locator(':focus')).toHaveCount(1);

    await page.keyboard.press('Escape');

    await expect(picker).toHaveCount(0);
    await expect(panel).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe('with the real animations', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

  test('a side panel slides in and out, and focus goes back to its card', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await card(page, 'Comprar tinta').click();
    const panel = page.getByRole('complementary', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    await settled(page);
    await page.keyboard.press('Escape');

    await expect(panel).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });

  test('an action menu opens and closes, returning focus to its trigger', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    const trigger = page.getByRole('button', {
      name: 'Ações da tarefa Comprar tinta',
      exact: true,
    });

    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true });
    await expect(menu).toBeVisible();
    await settled(page);
    await page.keyboard.press('Escape');

    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('a popover opens and closes, returning focus to its trigger', async ({ page }) => {
    const { initiativeId, taskIds } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds['Lixar parede'] ?? ''}`);
    const trigger = page
      .getByRole('complementary', { name: 'Tarefa', exact: true })
      .getByRole('button', { name: /^Prazo:/ });

    await trigger.click();
    const popover = page.getByRole('dialog', { name: 'Escolher prazo', exact: true });
    await expect(popover).toBeVisible();
    await settled(page);
    await page.keyboard.press('Escape');

    await expect(popover).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('reopening at once, while the first one still fades out', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

  test('an action menu is interactive again, with focus inside, and closes alone', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    const trigger = page.getByRole('button', {
      name: 'Ações da tarefa Comprar tinta',
      exact: true,
    });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true });
    await expect(menu).toBeVisible();
    await settled(page);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');

    await expect(menu).toBeVisible();
    await settled(page);
    await expect(menu).not.toHaveAttribute('inert');
    expect(await menu.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the calendar keeps focus inside, and Escape closes only it', async ({ page }) => {
    const { initiativeId, taskIds } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds['Lixar parede'] ?? ''}`);
    const panel = page.getByRole('complementary', { name: 'Tarefa', exact: true });
    const trigger = panel.getByRole('button', { name: /^Prazo:/ });
    await trigger.click();
    const popover = page.getByRole('dialog', { name: 'Escolher prazo', exact: true });
    await expect(popover).toBeVisible();
    await settled(page);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');

    await expect(popover).toBeVisible();
    await settled(page);
    await expect(popover).not.toHaveAttribute('inert');
    expect(await popover.evaluate((element) => element.contains(document.activeElement))).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(panel).toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe('with the real animations, on a phone', () => {
  test.use({ reducedMotion: 'no-preference', viewport: PHONE, hasTouch: true, isMobile: true });

  test('a sheet rises, and a tap on the veil closes it and returns focus', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await card(page, 'Comprar tinta').tap();
    const sheet = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(sheet).toBeVisible();
    await settled(page);
    await page.touchscreen.tap(195, 20);

    await expect(sheet).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });
});
