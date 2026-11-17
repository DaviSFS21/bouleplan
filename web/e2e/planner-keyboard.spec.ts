import { expect, test, type Locator, type Page } from '@playwright/test';
import { reserve, seedInitiative } from './api-seed';
import { resetDatabase } from './reset-database';

const NOW = '2026-11-18T10:30:00-03:00';

test.use({ timezoneId: 'America/Sao_Paulo', viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.clock.setFixedTime(new Date(NOW));
});

function block(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true });
}

function announced(page: Page): Locator {
  return page.getByRole('status', { name: 'Movimentos da agenda', exact: true });
}

async function seedWeek(page: Page) {
  const { taskIds } = await seedInitiative(page.request, 'Reforma', [
    { title: 'Comprar tinta', changes: { estimatedEffort: 2 } },
    { title: 'Lixar parede', changes: { estimatedEffort: 1 } },
  ]);
  await reserve(page.request, taskIds['Comprar tinta'] ?? '', '2026-11-18', {
    startTime: '09:00',
    endTime: '11:00',
  });
  await reserve(page.request, taskIds['Lixar parede'] ?? '', '2026-11-19');
  await page.goto('/semana');
  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();
}

test('moves and resizes a block with the keyboard, and announces each change', async ({ page }) => {
  await seedWeek(page);

  await block(page, 'Comprar tinta, 9:00 – 11:00').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(block(page, 'Comprar tinta, 9:15 – 11:15')).toBeFocused();
  await expect(announced(page)).toHaveText('Bloco movido para qua, 9:15–11:15.');

  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect(block(page, 'Comprar tinta, 9:15 – 11:30')).toBeFocused();
  await expect(announced(page)).toHaveText('Duração ajustada: qua, 9:15–11:30.');

  await page.keyboard.press('Alt+ArrowRight');
  await expect(
    page.locator('[data-day="2026-11-19"]').getByRole('group', {
      name: 'Comprar tinta, 9:15 – 11:30',
      exact: true,
    }),
  ).toBeFocused();
  await expect(announced(page)).toHaveText('Bloco movido para qui, 9:15–11:30.');
});

test('refuses to move a block into taken time, and sends nothing', async ({ page }) => {
  const { taskIds } = await seedInitiative(page.request, 'Reforma', [
    { title: 'Comprar tinta' },
    { title: 'Lixar parede' },
  ]);
  await reserve(page.request, taskIds['Comprar tinta'] ?? '', '2026-11-18', {
    startTime: '09:00',
    endTime: '11:00',
  });
  await reserve(page.request, taskIds['Lixar parede'] ?? '', '2026-11-18', {
    startTime: '11:00',
    endTime: '12:00',
  });
  await page.goto('/semana');

  await block(page, 'Comprar tinta, 9:00 – 11:00').focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect(announced(page)).toHaveText('Não cabe: já há tempo reservado.');
  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeFocused();
});

test('moves a ficha to another day and reserves time for it from its menu', async ({ page }) => {
  await seedWeek(page);
  const ficha = page
    .locator('[data-strip="2026-11-19"]')
    .getByRole('article', { name: 'Lixar parede', exact: true });

  await ficha.focus();
  await page.keyboard.press('Alt+ArrowLeft');
  const moved = page
    .locator('[data-strip="2026-11-18"]')
    .getByRole('article', { name: 'Lixar parede', exact: true });
  await expect(moved).toBeFocused();
  await expect(announced(page)).toHaveText('Tarefa movida para qua, 18 nov.');

  await moved.focus();
  await moved.getByRole('button', { name: 'Ações da tarefa Lixar parede', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reservar tempo…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reservar tempo', exact: true });
  await expect(dialog.getByLabel('Dia', { exact: true })).toBeFocused();
  await dialog.getByLabel('Início', { exact: true }).selectOption({ label: '10:00' });
  await dialog.getByRole('button', { name: 'Reservar', exact: true }).click();
  await expect(dialog.getByText('Não cabe: já há tempo reservado.', { exact: true })).toBeVisible();

  await dialog.getByLabel('Início', { exact: true }).selectOption({ label: '13:00' });
  await dialog.getByRole('button', { name: 'Reservar', exact: true }).click();
  await expect(block(page, 'Lixar parede, 13:00 – 14:00')).toBeFocused();
  await expect(announced(page)).toHaveText('Tempo reservado em qua, 13:00–14:00.');
});
