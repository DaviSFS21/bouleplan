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

  test('opens a task full screen over the bar, and "Voltar" returns focus to its card', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);

    await card(page, 'Comprar tinta').tap();

    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-modal', 'true');
    const area = await box(panel);
    expect(area.x).toBe(0);
    expect(area.width).toBe(390);
    expect(area.y).toBe(0);
    expect(area.y + area.height).toBe(844);
    const bar = await box(page.getByRole('navigation', { name: 'Seções', exact: true }));
    expect(
      await page.evaluate(
        ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('[role="dialog"]') !== null,
        [bar.x + 20, bar.y + 20],
      ),
    ).toBe(true);
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

  test('keeps the sheet and the toast inside the open panel, where "Desfazer" can be tapped', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });

    await panel.getByRole('button', { name: 'Ações da tarefa', exact: true }).tap();
    const sheet = panel.getByRole('menu', { name: 'Ações da tarefa', exact: true });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('menuitemradio', { name: 'Em andamento', exact: true }).tap();

    const undo = panel.getByRole('button', { name: 'Desfazer', exact: true });
    await expect(undo).toBeVisible();
    const area = await box(undo);
    expect(area.y + area.height).toBeLessThanOrEqual(844);
    expect(
      await undo.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        );
      }),
    ).toBe(true);
    await undo.tap();
    await expect(page.getByText('Tarefa movida para Em andamento')).toHaveCount(0);
  });

  test('offers the first initiative from the board when there is none', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByText('Nenhuma iniciativa ainda.', { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: '+ Nova iniciativa', exact: true }).tap();

    const drawer = page.getByRole('dialog', { name: 'Gaveta de iniciativas', exact: true });
    await expect(drawer.getByLabel('Nome da nova iniciativa', { exact: true })).toBeFocused();
    await page.keyboard.type('Reforma');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Reforma', exact: true }),
    ).toBeVisible();
  });

  test('every control of the open task panel is 44px and clear of its neighbours', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await card(page, 'Comprar tinta').tap();
    await expect(page.getByRole('dialog', { name: 'Tarefa', exact: true })).toBeVisible();

    expect(await touchProblems(page, '[role="dialog"][aria-label="Tarefa"]')).toEqual([]);
  });

  test('every control of the open initiative panel is 44px and clear of its neighbours', async ({
    page,
  }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}&detalhes=1`);
    await expect(page.getByRole('dialog', { name: 'Iniciativa', exact: true })).toBeVisible();

    expect(await touchProblems(page, '[role="dialog"][aria-label="Iniciativa"]')).toEqual([]);
  });

  test('every control of an open sheet is 44px and clear of its neighbours', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    let previous: unknown;
    await expect
      .poll(async () => {
        const box = JSON.stringify(await menu.boundingBox());
        const settled = box === previous;
        previous = box;
        return settled;
      })
      .toBe(true);

    expect(await touchProblems(page, '[role="menu"]')).toEqual([]);
  });

  test('the toast and its "Desfazer" are 44px', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Arquivar', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeVisible();

    expect(await touchProblems(page, '[role="status"][aria-label="Avisos"]')).toEqual([]);
  });

  test('every control of the reserve popover is 44px and clear of its neighbours', async ({
    page,
  }) => {
    const { taskIds } = await seedBoard(page);
    await reserve(page.request, taskIds['Comprar tinta'] ?? '', TODAY);
    await page.goto('/semana');
    await page.getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Reservar tempo…', exact: true }).tap();
    await expect(page.getByRole('dialog', { name: 'Reservar tempo', exact: true })).toBeVisible();

    expect(await touchProblems(page, '[role="dialog"][aria-label="Reservar tempo"]')).toEqual([]);
  });

  test('every control on the board is at least 44px to touch', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await expect(card(page, 'Comprar tinta')).toBeVisible();

    expect(await touchProblems(page)).toEqual([]);
  });

  test('every control on the week is at least 44px to touch', async ({ page }) => {
    const { taskIds } = await seedBoard(page);
    await reserve(page.request, taskIds['Comprar tinta'] ?? '', TODAY);
    await page.goto('/semana');
    await expect(page.locator(`[data-day="${TODAY}"]`)).toBeVisible();

    expect(await touchProblems(page)).toEqual([]);
  });
});

// A control is 44px by its box or by the ::after that grows it, and five points of its box (the
// quarters and the centre) must hit the control itself: a neighbour's area over it is an overlap.
async function touchProblems(page: Page, scope = 'body'): Promise<string[]> {
  return page.evaluate(
    ([root, minimum]) => {
      const scoped = document.querySelector(root);
      if (!scoped) throw new Error(`No element matches ${root}.`);
      const controls = scoped.querySelectorAll<HTMLElement>(
        'a[href], button:not([aria-hidden="true"]), input:not([type="hidden"]), select, textarea, [role="tab"]',
      );
      if (controls.length === 0) throw new Error(`No controls found in ${root}.`);
      const found: string[] = [];
      for (const element of controls) {
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        element.scrollIntoView({ block: 'center' });
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const after = getComputedStyle(element, '::after');
        const grown = after.content !== 'none' && after.position === 'absolute';
        const height = rect.height + (grown ? Math.abs(parseFloat(after.top)) * 2 : 0);
        const width = rect.width + (grown ? Math.abs(parseFloat(after.left)) * 2 : 0);
        const label = element.getAttribute('aria-label') ?? element.textContent.trim();
        const name = `${element.tagName.toLowerCase()} "${label}"`;
        if (height < minimum || width < minimum) {
          found.push(`${name} ${String(Math.round(width))}x${String(Math.round(height))}`);
        }
        // Quarter points stay inside rounded corners.
        const points = [
          [rect.left + rect.width / 4, rect.top + rect.height / 4],
          [rect.left + (rect.width * 3) / 4, rect.top + rect.height / 4],
          [rect.left + rect.width / 4, rect.top + (rect.height * 3) / 4],
          [rect.left + (rect.width * 3) / 4, rect.top + (rect.height * 3) / 4],
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
        ];
        const covered = points.some(([x, y]) => {
          const hit = document.elementFromPoint(x ?? 0, y ?? 0);
          return hit !== null && !element.contains(hit);
        });
        if (covered) found.push(`${name} is covered by another element`);
      }
      return found;
    },
    [scope, TOUCH_TARGET] as const,
  );
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

  test('a snapped day stops beside the hours gutter, not under it', async ({ page }) => {
    await seedBoard(page);
    await page.goto('/semana');
    const week = page.getByRole('group', { name: /^Semana \d+$/ });
    await expect(page.locator(`[data-day="${TODAY}"]`)).toBeVisible();

    // How far the first day that shows is from the gutter's right edge; it must not be negative.
    async function gapAfterGutter() {
      return week.evaluate((element) => {
        const gutter = element.querySelector('[data-hour]')?.parentElement?.parentElement;
        const edge = gutter?.getBoundingClientRect().right ?? 0;
        const days = Array.from(element.querySelectorAll<HTMLElement>('[data-day]'));
        const first = days
          .map((day) => day.getBoundingClientRect())
          .find((rect) => rect.right > edge);
        return Math.round((first?.left ?? -1000) - edge);
      });
    }

    await expect.poll(gapAfterGutter).toBeGreaterThanOrEqual(0);

    await week.evaluate((element) => {
      element.scrollTo({ left: 330, behavior: 'instant' });
    });
    await expect.poll(gapAfterGutter).toBeGreaterThanOrEqual(0);
  });
});
