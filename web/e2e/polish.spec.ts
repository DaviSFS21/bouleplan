import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoSeriousViolations } from './axe';
import { seedInitiative, type World } from './api-seed';
import { box, dragDown } from './drag-sheet';
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

test.describe('the header on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows the lockup, the sections and an empty account area, and stays on top', async ({
    page,
  }) => {
    await seedBoard(page);
    await page.goto('/');

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Bouléplan', exact: true })).toHaveAttribute(
      'href',
      '/',
    );
    const nav = header.getByRole('navigation', { name: 'Seções', exact: true });
    await expect(nav.getByRole('link')).toHaveText(['Quadro', 'Semana', 'Introspecto']);
    await expect(nav.getByRole('link', { name: 'Quadro', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(header.locator('[data-slot="account"]')).toBeEmpty();
    expect((await box(header)).height).toBeLessThanOrEqual(48);
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
    const lockup = await box(header.locator('img:visible'));
    expect(lockup.height).toBeLessThanOrEqual(32);
    await expect(header.locator('img:visible')).toHaveCount(1);
  });

  test('has no serious accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();

    await expectNoSeriousViolations(page);
  });

  test('serves the favicon, the app icons and a manifest that names them', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="icon"][href*="icon"]').first()).toHaveAttribute(
      'href',
      /icon/,
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    const manifest = await page.request.get('/manifest.webmanifest');
    const body = (await manifest.json()) as { icons: { src: string; purpose: string }[] };
    expect(body.icons.map(({ src }) => src)).toEqual(['/icon-192.png', '/icon-512.png']);
    expect(body.icons.map(({ purpose }) => purpose)).toEqual(['any maskable', 'any maskable']);
    for (const { src } of body.icons) {
      expect((await page.request.get(src)).ok()).toBe(true);
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test('shows a compact top bar with the current section', async ({ page }) => {
    await page.goto('/semana');

    const bar = page.getByRole('banner');
    await expect(bar).toHaveText('Semana');
    await expect(bar.getByRole('link')).toHaveCount(0);
    expect((await box(bar)).height).toBeLessThanOrEqual(48);
    await expectNoSeriousViolations(page);
  });

  test('closes the task sheet with a tap on the veil, and keeps the card focused', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();

    await page.touchscreen.tap(195, 20);

    await expect(panel).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });

  test('closes the task sheet when its handle is dragged down, but not on a short drag', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    const handle = panel.locator('[data-sheet-handle]');
    const before = await box(panel.locator('[data-sheet]'));

    await dragDown(page, handle, 12);

    await expect(panel).toBeVisible();
    await expect
      .poll(async () => (await box(panel.locator('[data-sheet]'))).y)
      .toBeCloseTo(before.y, 0);

    await dragDown(page, handle, 220);

    await expect(panel).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });

  test('cancels a title being typed when the veil is tapped', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    const title = panel.getByRole('textbox', { name: 'Título da tarefa', exact: true });
    await title.fill('Outro título');

    await page.touchscreen.tap(195, 20);

    await expect(panel).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeVisible();
    await expect(card(page, 'Outro título')).toHaveCount(0);
  });

  test('closes the initiative sheet by the veil and by the drag', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&detalhes=1`);
    const panel = page.getByRole('dialog', { name: 'Iniciativa', exact: true });
    await expect(panel).toBeVisible();
    await page.touchscreen.tap(195, 20);
    await expect(panel).toHaveCount(0);

    await page.goto(`/?iniciativa=${initiativeId}&detalhes=1`);
    await expect(panel).toBeVisible();
    await dragDown(page, panel.locator('[data-sheet-handle]'), 260);

    await expect(panel).toHaveCount(0);
  });

  test('closes an action sheet when its handle is dragged down', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    const trigger = page.getByRole('button', {
      name: 'Ações da tarefa Comprar tinta',
      exact: true,
    });
    await trigger.tap();
    const menu = page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true });
    await expect(menu).toBeVisible();

    await dragDown(page, menu.locator('[data-sheet-handle]'), 260);

    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('the open task sheet has no serious accessibility violations', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    await expect(page.getByRole('dialog', { name: 'Tarefa', exact: true })).toBeVisible();

    await expectNoSeriousViolations(page);
  });
});

test.describe('the Introspecto answer', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sits in a raised balloon with an invitation, and grows without a scrollbar', async ({
    page,
  }) => {
    await seedBoard(page);
    await page.goto('/introspecto');
    const answer = page.getByRole('textbox').first();
    await expect(answer).toHaveAttribute('placeholder', 'Escreva com calma…');

    const style = await answer.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        shadow: computed.boxShadow,
        radius: computed.borderTopLeftRadius,
        padding: computed.paddingTop,
        overflow: computed.overflowY,
      };
    });
    expect(style.shadow).not.toBe('none');
    expect(style.radius).toBe('8px');
    expect(style.padding).toBe('16px');
    expect(style.overflow).toBe('hidden');

    const resting = await answer.evaluate((element) => getComputedStyle(element).boxShadow);
    await answer.focus();
    await expect
      .poll(() => answer.evaluate((element) => getComputedStyle(element).boxShadow))
      .not.toBe(resting);

    const before = await box(answer);
    await answer.fill('Linha um\nLinha dois\nLinha três\nLinha quatro\nLinha cinco');
    expect((await box(answer)).height).toBeGreaterThan(before.height);
    expect(
      await answer.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
    ).toBe(true);
  });
});
