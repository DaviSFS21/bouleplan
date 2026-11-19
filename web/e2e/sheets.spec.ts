import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedInitiative, type World } from './api-seed';
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
