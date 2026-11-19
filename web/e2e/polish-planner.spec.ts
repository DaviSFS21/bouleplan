import { expect, test, type Locator, type Page } from '@playwright/test';
import { reserve, seedInitiative, type World } from './api-seed';
import { expectNoSeriousViolations } from './axe';
import { pickDate } from './pick-date';
import { resetDatabase } from './reset-database';

const NOW = '2026-11-18T10:30:00-03:00';
const TODAY = '2026-11-18';
const HOUR_PX = 48;

test.use({ timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.clock.setFixedTime(new Date(NOW));
});

function block(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true });
}

function week(page: Page): Locator {
  return page.getByRole('group', { name: /^Semana \d+$/ });
}

// Opacity transitions are still running with reduced motion, and axe reads colors mid-fade.
async function settled(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map(({ finished }) => finished)));
}

async function seedWeek(page: Page): Promise<World> {
  const world = await seedInitiative(page.request, 'Reforma', [
    { title: 'Comprar tinta', changes: { estimatedEffort: 4, deadline: TODAY } },
    { title: 'Lixar parede', changes: { estimatedEffort: 3 } },
  ]);
  await reserve(page.request, world.taskIds['Comprar tinta'] ?? '', TODAY, {
    startTime: '09:00',
    endTime: '11:00',
  });
  await reserve(page.request, world.taskIds['Lixar parede'] ?? '', TODAY, {
    startTime: '11:00',
    endTime: '12:00',
  });
  return world;
}

test.describe('the week at desktop size', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('draws the whole day, opens on 8h and puts the deadline at 21h', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');
    await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();

    await expect(page.locator('[data-hour]')).toHaveCount(25);
    const view = await week(page).boundingBox();
    const eight = await page.locator('[data-hour="8"]').boundingBox();
    if (!view || !eight) throw new Error('The week must be on screen.');
    expect(eight.y - view.y).toBeGreaterThan(0);
    expect(eight.y - view.y).toBeLessThan(120);

    const agenda = page.locator(`[data-day="${TODAY}"]`);
    const agendaBox = await agenda.boundingBox();
    const line = await page
      .getByRole('button', { name: /^prazo · Comprar tinta/ })
      .locator('xpath=..')
      .boundingBox();
    if (!agendaBox || !line) throw new Error('The day must be on screen.');
    expect(Math.abs(line.y + line.height - (agendaBox.y + 21 * HOUR_PX))).toBeLessThan(4);

    const before = await agenda.locator('[data-shade="before"]').boundingBox();
    expect(before?.height).toBe(8 * HOUR_PX);
    await expect(agenda.locator('[data-shade="after"]')).toHaveCount(1);
  });

  test('keeps the day names in view while the hours scroll', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');
    await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();

    await week(page).evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const head = page
      .locator(`[data-day="${TODAY}"]`)
      .locator('xpath=..')
      .locator('[data-week-head]');
    const view = await week(page).boundingBox();
    const named = await head.boundingBox();
    if (!view || !named) throw new Error('The week must be on screen.');
    expect(named.y).toBeGreaterThanOrEqual(view.y - 1);
    expect(named.y).toBeLessThan(view.y + 20);
  });

  test('edits a block in its popover, refuses an overlap and saves', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');
    const writes: string[] = [];
    page.on('request', (request) => {
      if (['PATCH', 'POST', 'DELETE'].includes(request.method())) writes.push(request.method());
    });

    await block(page, 'Comprar tinta, 9:00 – 11:00').click();
    const dialog = page.getByRole('dialog', { name: 'Comprar tinta', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Dia', { exact: true })).toBeFocused();
    await expect(dialog.getByText('2h', { exact: true })).toBeVisible();

    await dialog.getByLabel('Fim', { exact: true }).selectOption({ label: '11:30' });
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Não cabe: já há tempo reservado.');
    await expect(dialog).toBeVisible();
    expect(writes).toEqual([]);

    await dialog.getByLabel('Início', { exact: true }).selectOption({ label: '13:00' });
    await dialog
      .getByLabel('Dia', { exact: true })
      .selectOption({ label: 'quinta-feira, 19 de novembro' });
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();

    await expect(page.getByText('Tempo movido', { exact: true })).toBeVisible();
    await expect(
      page
        .locator('[data-day="2026-11-19"]')
        .getByRole('group', { name: 'Comprar tinta, 13:00 – 15:30' }),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual(['PATCH']);

    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();
  });

  test('opens a block with Enter, closes with Escape and gives focus back', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');

    await block(page, 'Comprar tinta, 9:00 – 11:00').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Comprar tinta', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeFocused();
  });

  test('opens the task from the popover and takes the block off the agenda', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');

    await block(page, 'Lixar parede, 11:00 – 12:00').click();
    await page.getByRole('button', { name: 'Tirar da agenda', exact: true }).click();
    await expect(block(page, 'Lixar parede, 11:00 – 12:00')).toHaveCount(0);

    await block(page, 'Comprar tinta, 9:00 – 11:00').click();
    await page.getByRole('button', { name: 'Abrir tarefa Comprar tinta', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Tarefa', exact: true })).toBeVisible();
  });
});

test.describe('the date picker at desktop size', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  async function openTask(page: Page, title: string) {
    const { initiativeId, taskIds } = await seedWeek(page);
    await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds[title] ?? ''}`);
    const panel = page.getByRole('complementary', { name: 'Tarefa', exact: true });
    await expect(panel).toBeVisible();
    return panel;
  }

  test('picks a deadline with the keyboard, in Portuguese, and returns focus', async ({ page }) => {
    const panel = await openTask(page, 'Lixar parede');
    const trigger = panel.getByRole('button', { name: /^Prazo:/ });

    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Escolher prazo', exact: true });
    await expect(dialog.getByRole('status')).toHaveText('novembro 2026');
    await expect(dialog.locator('th')).toHaveText(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
    await expect(
      dialog.getByRole('button', { name: /quarta-feira, 18 de novembro/ }),
    ).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(dialog).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /^Prazo: vence sex, 20 nov/ })).toBeFocused();
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
  });

  test('closes with Escape without choosing, and uses "Hoje" and "Limpar"', async ({ page }) => {
    const panel = await openTask(page, 'Lixar parede');
    const trigger = panel.getByRole('button', { name: /^Prazo:/ });

    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Escolher prazo' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText('sem prazo');

    await trigger.click();
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await expect(panel.getByRole('button', { name: /^Prazo: vence hoje/ })).toBeVisible();

    await panel.getByRole('button', { name: /^Prazo:/ }).click();
    await page.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Prazo: sem prazo' })).toBeVisible();
  });

  test('picks a far-off year, and stops the months at year 1', async ({ page }) => {
    const panel = await openTask(page, 'Lixar parede');

    await pickDate(page, panel.getByRole('button', { name: /^Prazo:/ }), '2099-12-18');
    await expect(
      panel.getByRole('button', { name: 'Prazo: vence sex, 18 dez 2099', exact: true }),
    ).toBeVisible();

    await pickDate(page, panel.getByRole('button', { name: /^Prazo:/ }), '0001-01-15');
    await panel.getByRole('button', { name: /^Prazo:/ }).click();
    await expect(page.getByRole('button', { name: 'Ir para o mês anterior' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Escape');
  });

  test('picks the week from the calendar, showing the week of the day', async ({ page }) => {
    const panel = await openTask(page, 'Lixar parede');
    const field = panel.getByRole('group', { name: 'Semana', exact: true });

    await field.getByRole('button', { name: 'Escolher semana no calendário' }).click();
    const dialog = page.getByRole('dialog', { name: 'Escolher semana', exact: true });
    await dialog.getByRole('button', { name: /quinta-feira, 26 de novembro/ }).click();

    await expect(dialog).toHaveCount(0);
    await expect(field.getByText('23 a 29 nov', { exact: false })).toBeVisible();
    await field.getByRole('button', { name: 'Escolher semana no calendário' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Escolher semana' }).locator('td[class*="week"]'),
    ).toHaveCount(7);
    await page.keyboard.press('Escape');
    await expect(
      field.getByRole('button', { name: 'Escolher semana no calendário' }),
    ).toBeFocused();
  });

  test('the block popover has no serious violations', async ({ page }) => {
    await seedWeek(page);
    await page.goto('/semana');
    await block(page, 'Comprar tinta, 9:00 – 11:00').click();
    await expect(page.getByRole('dialog', { name: 'Comprar tinta', exact: true })).toBeVisible();

    await settled(page);
    await expectNoSeriousViolations(page);
  });

  test('the calendar has no serious violations', async ({ page }) => {
    const panel = await openTask(page, 'Lixar parede');
    await panel.getByRole('button', { name: /^Prazo:/ }).click();
    await expect(page.getByRole('dialog', { name: 'Escolher prazo', exact: true })).toBeVisible();

    await settled(page);
    await expectNoSeriousViolations(page);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the block popover and the calendar rise as sheets, and the veil closes them', async ({
    page,
  }) => {
    const { initiativeId, taskIds } = await seedWeek(page);
    await page.goto('/semana');
    await block(page, 'Comprar tinta, 9:00 – 11:00').tap();

    const sheet = page.getByRole('dialog', { name: 'Comprar tinta', exact: true });
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet.getByLabel('Dia', { exact: true })).toBeFocused();
    await settled(page);
    await expectNoSeriousViolations(page);
    await page.locator('[class*="veil"]').tap({ position: { x: 5, y: 5 } });
    await expect(sheet).toHaveCount(0);
    await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeFocused();

    await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds['Lixar parede'] ?? ''}`);
    const panel = page.getByRole('dialog', { name: 'Tarefa', exact: true });
    await panel.getByRole('button', { name: /^Prazo:/ }).tap();
    const picker = page.getByRole('dialog', { name: 'Escolher prazo', exact: true });
    await expect(picker).toHaveAttribute('aria-modal', 'true');
    await settled(page);
    await expectNoSeriousViolations(page);
    await picker.getByRole('button', { name: /sexta-feira, 20 de novembro/ }).tap();

    await expect(picker).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /^Prazo: vence sex, 20 nov/ })).toBeVisible();
  });
});
