import { expect, test, type Locator, type Page } from '@playwright/test';
import { reserve, seedInitiative, type World } from './api-seed';
import { resetDatabase } from './reset-database';

const NOW = '2026-11-18T10:30:00-03:00';
const TODAY = '2026-11-18';
const TOUCH_TARGET = 44;

test.use({ timezoneId: 'America/Sao_Paulo' });

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.clock.setFixedTime(new Date(NOW));
});

async function seedBoard(page: Page): Promise<World> {
  return seedInitiative(page.request, 'Reforma', [
    { title: 'Comprar tinta', changes: { priority: 'P1' } },
    { title: 'Lixar parede', changes: { status: 'in_progress' } },
    { title: 'Pedir orçamento', changes: { status: 'done' } },
  ]);
}

function card(page: Page, title: string): Locator {
  return page.getByRole('article', { name: title, exact: true });
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Expected the element to have a box.');
  return found;
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the navigation is a bottom bar of two links', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Seções', exact: true });
    const board = nav.getByRole('link', { name: 'Quadro', exact: true });
    const week = nav.getByRole('link', { name: 'Semana', exact: true });
    await expect(board).toHaveAttribute('aria-current', 'page');
    await expect(week).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tablist', { name: 'Seções' })).toHaveCount(0);

    const bar = await box(nav);
    expect(bar.y + bar.height).toBeCloseTo(844, 0);
    expect((await box(board)).height).toBeGreaterThanOrEqual(52);

    await week.tap();
    await expect(page).toHaveURL(/\/semana/);
    await expect(week).toHaveAttribute('aria-current', 'page');
  });

  test('switches the states with the tabs, one column at a time', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    const tabs = page.getByRole('tablist', { name: 'Estados', exact: true });
    await expect(tabs.getByRole('tab')).toHaveText([
      'A fazer · 1',
      'Em andamento · 1',
      'Feito · 1',
    ]);
    await expect(card(page, 'Comprar tinta')).toBeVisible();
    await expect(card(page, 'Lixar parede')).toHaveCount(0);

    await tabs.getByRole('tab', { name: 'Em andamento · 1', exact: true }).tap();
    await expect(card(page, 'Lixar parede')).toBeVisible();
    await expect(card(page, 'Comprar tinta')).toHaveCount(0);

    await tabs.getByRole('tab', { name: 'Em andamento · 1', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(card(page, 'Pedir orçamento')).toBeVisible();
    await expect(tabs.getByRole('tab', { name: 'Feito · 1', exact: true })).toBeFocused();
  });

  test('opens a task full screen above the bar, and "Voltar" returns focus to its card', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await card(page, 'Comprar tinta').tap();

    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    const area = await box(panel);
    const bar = await box(page.getByRole('navigation', { name: 'Seções', exact: true }));
    expect(area.x).toBe(0);
    expect(area.width).toBe(390);
    expect(area.y).toBe(0);
    expect(area.y + area.height).toBeLessThanOrEqual(bar.y + 1);
    await expect(panel.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Voltar', exact: true }).tap();

    await expect(panel).toHaveCount(0);
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });

  test('keeps Tab inside the full screen panel', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(panel).toBeFocused();

    for (let presses = 0; presses < 40; presses += 1) await page.keyboard.press('Tab');

    expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  });

  test('moves a task through the sheet menu, which rises from the bottom', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();

    const sheet = page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true });
    await expect(sheet).toBeVisible();
    await expect
      .poll(async () => {
        const area = await box(sheet);
        return [area.x, area.width, Math.round(area.y + area.height)];
      })
      .toEqual([0, 390, 844]);
    const item = await box(sheet.getByRole('menuitem', { name: 'Editar título' }));
    expect(item.height).toBeGreaterThanOrEqual(TOUCH_TARGET);

    await sheet.getByRole('menuitemradio', { name: 'Em andamento', exact: true }).tap();

    await expect(page.getByText('Tarefa movida para Em andamento')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Em andamento · 2', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(card(page, 'Comprar tinta')).toBeVisible();
    await expect(card(page, 'Comprar tinta')).toBeFocused();
  });

  test('closes the sheet with a tap on the veil, without touching what is behind', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    const trigger = page.getByRole('button', {
      name: 'Ações da tarefa Comprar tinta',
      exact: true,
    });
    await trigger.tap();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.touchscreen.tap(200, 100);

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('chooses an initiative in the drawer', async ({ page }) => {
    await seedInitiative(page.request, 'Reforma', [{ title: 'Comprar tinta' }]);
    await seedInitiative(page.request, 'Horta', [{ title: 'Plantar alface' }]);
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Iniciativas', exact: true });
    await expect(page.getByRole('navigation', { name: 'Iniciativas', exact: true })).toHaveCount(0);

    await opener.tap();

    const drawer = page.getByRole('dialog', { name: 'Gaveta de iniciativas', exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: /^Horta/ }).tap();

    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Horta', exact: true })).toBeVisible();
    await expect(opener).toBeFocused();
  });

  test('the week shows one day, and the day strip switches days', async ({ page }) => {
    const { taskIds } = await seedBoard(page);
    await reserve(page.request, taskIds['Comprar tinta'] ?? '', TODAY);
    await reserve(page.request, taskIds['Lixar parede'] ?? '', '2026-11-19');
    await page.goto('/semana');

    const days = page.getByRole('tablist', { name: 'Dias da semana', exact: true });
    await expect(days.getByRole('tab')).toHaveCount(7);
    await expect(days.getByRole('tab', { name: /quarta-feira.*hoje/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('[data-day]')).toHaveCount(1);
    await expect(page.locator(`[data-day="${TODAY}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-strip="${TODAY}"]`).getByRole('article', { name: 'Comprar tinta' }),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Para planejar', exact: true }),
    ).toBeHidden();

    await days.getByRole('tab', { name: /quinta-feira/ }).tap();

    await expect(page.locator('[data-day]')).toHaveCount(1);
    await expect(page.locator('[data-day="2026-11-19"]')).toBeVisible();
    await expect(
      page.locator('[data-strip="2026-11-19"]').getByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
  });

  test('toasts sit above the bottom bar', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Arquivar', exact: true }).tap();

    const toast = page.getByText('Tarefa arquivada');
    await expect(toast).toBeVisible();

    const bar = await box(page.getByRole('navigation', { name: 'Seções', exact: true }));
    const area = await box(toast);
    expect(area.y + area.height).toBeLessThanOrEqual(bar.y);
  });

  test('every control on the board is at least 44px to touch', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await expect(card(page, 'Comprar tinta')).toBeVisible();

    const small = await smallTargets(page);

    expect(small).toEqual([]);
  });

  test('every control on the week is at least 44px to touch', async ({ page }) => {
    const { taskIds } = await seedBoard(page);
    await reserve(page.request, taskIds['Comprar tinta'] ?? '', TODAY);
    await page.goto('/semana');
    await expect(page.locator(`[data-day="${TODAY}"]`)).toBeVisible();

    const small = await smallTargets(page);

    expect(small).toEqual([]);
  });
});

// The hit area of a control is its box, or the box of its ::after, which the menu triggers grow.
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((minimum) => {
    const controls = document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="tab"]',
    );
    const found: string[] = [];
    for (const element of controls) {
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const after = getComputedStyle(element, '::after');
      const grown = after.content !== 'none' && after.position === 'absolute';
      const inset = grown ? Math.abs(parseFloat(after.top)) * 2 : 0;
      const insetX = grown ? Math.abs(parseFloat(after.left)) * 2 : 0;
      const label = element.getAttribute('aria-label') ?? element.textContent.trim();
      if (rect.height + inset < minimum || rect.width + insetX < minimum) {
        found.push(
          `${element.tagName.toLowerCase()} "${label}" ${String(Math.round(rect.width + insetX))}x${String(Math.round(rect.height + inset))}`,
        );
      }
    }
    return found;
  }, TOUCH_TARGET);
}

test.describe('with reduced motion', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });

  test('the sheet and the drawer appear without animation', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();
    const sheet = page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true });
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Iniciativas', exact: true }).tap();
    const drawer = page.getByRole('dialog', { name: 'Gaveta de iniciativas', exact: true });
    await expect(drawer).toBeVisible();
    expect(await drawer.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'none',
    );
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 900, height: 1000 }, hasTouch: true });

  test('the index is a drawer with a veil, closed by Esc and by a tap on the veil', async ({
    page,
  }) => {
    await seedBoard(page);
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Iniciativas', exact: true });
    await expect(page.getByRole('navigation', { name: 'Iniciativas', exact: true })).toHaveCount(0);

    await opener.tap();
    const drawer = page.getByRole('dialog', { name: 'Gaveta de iniciativas', exact: true });
    await expect(drawer).toBeVisible();
    await expect
      .poll(async () => {
        const edge = await box(drawer);
        return [edge.x, edge.width < 400];
      })
      .toEqual([0, true]);

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();

    await opener.tap();
    await expect(drawer).toBeVisible();
    await page.touchscreen.tap(800, 500);
    await expect(drawer).toHaveCount(0);
  });

  test('the board scrolls sideways with snap, 300px columns and a lateral panel', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    const columns = page.locator('[data-column="to_do"]').locator('..');

    await expect(page.getByRole('region', { name: 'Feito', exact: true })).toBeAttached();
    const { snap, scrolls } = await columns.evaluate((element) => ({
      snap: getComputedStyle(element).scrollSnapType,
      scrolls: element.scrollWidth > element.clientWidth,
    }));
    expect(snap).toContain('x mandatory');
    expect(scrolls).toBe(true);
    expect((await box(page.locator('[data-column="to_do"]'))).width).toBe(300);

    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('complementary', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    expect((await box(panel)).width).toBe(460);
  });

  test('the week scrolls sideways with snap, about four 160px days, and has no tray', async ({
    page,
  }) => {
    await seedBoard(page);
    await page.goto('/semana');
    const week = page.getByRole('group', { name: /^Semana \d+$/ });

    await expect(page.locator(`[data-day="${TODAY}"]`)).toBeVisible();
    const { snap, scrolls } = await week.evaluate((element) => ({
      snap: getComputedStyle(element).scrollSnapType,
      scrolls: element.scrollWidth > element.clientWidth,
    }));
    expect(snap).toContain('x mandatory');
    expect(scrolls).toBe(true);
    expect((await box(page.locator(`[data-day="${TODAY}"]`))).width).toBe(160);
    await expect(
      page.getByRole('complementary', { name: 'Para planejar', exact: true }),
    ).toBeHidden();
  });
});
