import { expect, test, type Page } from '@playwright/test';
import { resetDatabase } from './reset-database';

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

function epicButton(page: Page, label: string) {
  return index(page).getByRole('button', { name: label, exact: true });
}

async function createEpics(page: Page, ...names: string[]) {
  await index(page).getByRole('button', { name: '+ Novo épico', exact: true }).click();
  const field = page.getByLabel('Nome do novo épico');
  for (const [position, name] of names.entries()) {
    await field.fill(name);
    await field.press('Enter');
    await expect(epicButton(page, `Épico ${String(position + 1)} · ${name}`)).toBeVisible();
  }
  await field.press('Escape');
}

async function epicMenu(page: Page, name: string, item: string) {
  await index(page)
    .getByRole('button', { name: `Ações do épico ${name}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('creates two epics numbered in order', async ({ page }) => {
  await createInitiative(page, 'Reforma');

  await createEpics(page, 'Demolição', 'Piso');

  await expect(index(page).getByRole('button', { name: /^Épico \d · / })).toHaveText([
    'Épico 1 · Demolição',
    'Épico 2 · Piso',
  ]);
});

test('filters by an epic, shows the path, survives a reload and clears on a second click', async ({
  page,
}) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição', 'Piso');

  await epicButton(page, 'Épico 2 · Piso').click();

  await expect(epicButton(page, 'Épico 2 · Piso')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?iniciativa=[0-9a-f-]+&epico=[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('button', { name: 'Reforma', exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(epicButton(page, 'Épico 2 · Piso')).toHaveAttribute('aria-pressed', 'true');

  await epicButton(page, 'Épico 2 · Piso').click();

  await expect(page).toHaveURL(/\?iniciativa=[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
});

test('renames an epic from its menu', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição');

  await epicMenu(page, 'Demolição', 'Editar nome');
  const field = index(page).getByRole('textbox', { name: 'Nome do épico' });
  await field.fill('Retirada');
  await field.press('Enter');

  await expect(epicButton(page, 'Épico 1 · Retirada')).toBeVisible();
  await expect(epicButton(page, 'Épico 1 · Retirada')).toBeFocused();
});

test('archives an epic and undoes it', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição', 'Piso');

  await epicMenu(page, 'Demolição', 'Arquivar');

  await expect(page.getByText('Épico arquivado')).toBeVisible();
  await expect(epicButton(page, 'Épico 1 · Piso')).toBeVisible();
  await expect(index(page).getByText(/Demolição/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Desfazer' }).click();

  await expect(epicButton(page, 'Épico 1 · Demolição')).toBeVisible();
  await expect(epicButton(page, 'Épico 2 · Piso')).toBeVisible();
});

test('deletes the filtered epic, which clears the filter, and undo re-applies it', async ({
  page,
}) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição', 'Piso');
  await epicButton(page, 'Épico 2 · Piso').click();
  await expect(page).toHaveURL(/epico=/);

  await epicMenu(page, 'Piso', 'Excluir');

  await expect(page.getByText('Épico excluída')).toBeVisible();
  await expect(page).not.toHaveURL(/epico=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(page).toHaveURL(/epico=/);
});

test('lists, filters and creates epics in the panel', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição');
  await page.getByRole('heading', { level: 1 }).getByRole('button', { name: 'Reforma' }).click();
  const panel = page.getByRole('complementary', { name: 'Iniciativa' });

  await expect(
    panel.getByRole('button', { name: 'Épico 1 · Demolição', exact: true }),
  ).toBeVisible();
  await panel.getByRole('button', { name: '+ Novo épico', exact: true }).click();
  await panel.getByLabel('Nome do novo épico').fill('Piso');
  await panel.getByLabel('Nome do novo épico').press('Enter');
  await expect(panel.getByRole('button', { name: 'Épico 2 · Piso', exact: true })).toBeVisible();

  await panel.getByRole('button', { name: 'Épico 2 · Piso', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(page).toHaveURL(/detalhes=1/);
});

test('counts the epics in the archive notice of the initiative', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createEpics(page, 'Demolição', 'Piso');

  await index(page).getByRole('button', { name: 'Ações de Reforma', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();

  await expect(page.getByText('Iniciativa arquivada, com 2 épicos')).toBeVisible();
});
