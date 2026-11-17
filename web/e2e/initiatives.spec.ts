import { expect, test, type Page } from '@playwright/test';
import { resetDatabase } from './reset-database';

const SELECTED_URL = /\?iniciativa=[0-9a-f-]+$/;

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.goto('/');
});

async function createInitiative(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Nova iniciativa' }).click();
  await page.getByLabel('Nome da nova iniciativa').fill(name);
  await page.getByLabel('Nome da nova iniciativa').press('Enter');
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

function index(page: Page) {
  return page.getByRole('navigation', { name: 'Iniciativas' });
}

function allTasks(page: Page) {
  return page.getByRole('button', { name: 'Todas as tarefas' });
}

function initiativeItem(page: Page, name: string) {
  return index(page).getByRole('button', { name: new RegExp(`^${name}`) });
}

async function dotColors(page: Page, name: string, token: string) {
  const dot = initiativeItem(page, name).locator('[aria-hidden="true"]');
  return {
    actual: await dot.evaluate((element) => getComputedStyle(element).backgroundColor),
    expected: await page.evaluate((variable) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = `var(${variable})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    }, token),
  };
}

test('shows the empty state', async ({ page }) => {
  await expect(index(page)).toBeVisible();
  await expect(page.getByText('Nenhuma iniciativa ainda.')).toBeVisible();
  await expect(allTasks(page)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();
});

test('creates an initiative and selects it', async ({ page }) => {
  await createInitiative(page, 'Horta');

  await expect(page).toHaveURL(SELECTED_URL);
  await expect(initiativeItem(page, 'Horta')).toHaveAttribute('aria-current', 'true');
  await expect(allTasks(page)).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Nenhuma iniciativa ainda.')).toBeHidden();
  await expect(page.getByLabel('Nome da nova iniciativa')).toBeHidden();
});

test('gives new initiatives colors in palette order', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await createInitiative(page, 'Casa');
  await createInitiative(page, 'Estudos');

  for (const [name, token] of [
    ['Horta', '--ini-amarelo'],
    ['Casa', '--ini-lima'],
    ['Estudos', '--ini-verde'],
  ] as const) {
    const { actual, expected } = await dotColors(page, name, token);
    expect(actual).toBe(expected);
  }

  const horta = await dotColors(page, 'Horta', '--ini-amarelo');
  const casa = await dotColors(page, 'Casa', '--ini-lima');
  expect(new Set([horta.actual, casa.actual]).size).toBe(2);
});

test('keeps the selection after a reload', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await createInitiative(page, 'Casa');
  const url = page.url();

  await page.reload();

  await expect(page).toHaveURL(url);
  await expect(page.getByRole('heading', { level: 1, name: 'Casa' })).toBeVisible();
  await expect(initiativeItem(page, 'Casa')).toHaveAttribute('aria-current', 'true');
  await expect(initiativeItem(page, 'Horta')).not.toHaveAttribute('aria-current', 'true');
});

test('clears the selection with "Todas as tarefas"', async ({ page }) => {
  await createInitiative(page, 'Horta');

  await allTasks(page).click();

  await expect(page).not.toHaveURL(/iniciativa=/);
  await expect(allTasks(page)).toHaveAttribute('aria-current', 'true');
  await expect(initiativeItem(page, 'Horta')).not.toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();
});

test('shows the blank-name message and keeps the field', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nova iniciativa' }).click();
  const field = page.getByLabel('Nome da nova iniciativa');
  await field.press('Enter');

  await expect(index(page).getByRole('alert')).toHaveText('Dê um nome à iniciativa.');
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page).not.toHaveURL(/iniciativa=/);
  await expect(page.getByText('Nenhuma iniciativa ainda.')).toBeVisible();
});

test('cancels with Escape', async ({ page }) => {
  await page.getByRole('button', { name: '+ Nova iniciativa' }).click();
  const field = page.getByLabel('Nome da nova iniciativa');
  await field.fill('Rascunho');

  await field.press('Escape');

  await expect(field).toBeHidden();
  await expect(page.getByRole('button', { name: '+ Nova iniciativa' })).toBeVisible();
  await expect(page.getByText('Nenhuma iniciativa ainda.')).toBeVisible();
  await expect(page).not.toHaveURL(/iniciativa=/);
});
