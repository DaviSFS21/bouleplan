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

function phaseButton(page: Page, label: string) {
  return index(page).getByRole('button', { name: label });
}

async function createPhases(page: Page, ...names: string[]) {
  await index(page).getByRole('button', { name: '+ Nova fase' }).click();
  const field = page.getByLabel('Nome da nova fase');
  for (const [position, name] of names.entries()) {
    await field.fill(name);
    await field.press('Enter');
    await expect(phaseButton(page, `Fase ${String(position + 1)} · ${name}`)).toBeVisible();
  }
  await field.press('Escape');
}

async function phaseMenu(page: Page, name: string, item: string) {
  await index(page)
    .getByRole('button', { name: `Ações da fase ${name}` })
    .click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('creates two phases numbered in order', async ({ page }) => {
  await createInitiative(page, 'Reforma');

  await createPhases(page, 'Demolição', 'Piso');

  await expect(index(page).getByRole('button', { name: /^Fase \d · / })).toHaveText([
    'Fase 1 · Demolição',
    'Fase 2 · Piso',
  ]);
});

test('filters by a phase, shows the path, survives a reload and clears on a second click', async ({
  page,
}) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição', 'Piso');

  await phaseButton(page, 'Fase 2 · Piso').click();

  await expect(phaseButton(page, 'Fase 2 · Piso')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?iniciativa=[0-9a-f-]+&fase=[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'Reforma' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(phaseButton(page, 'Fase 2 · Piso')).toHaveAttribute('aria-pressed', 'true');

  await phaseButton(page, 'Fase 2 · Piso').click();

  await expect(page).toHaveURL(/\?iniciativa=[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
});

test('renames a phase from its menu', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição');

  await phaseMenu(page, 'Demolição', 'Editar nome');
  const field = index(page).getByRole('textbox', { name: 'Nome da fase' });
  await field.fill('Retirada');
  await field.press('Enter');

  await expect(phaseButton(page, 'Fase 1 · Retirada')).toBeVisible();
  await expect(phaseButton(page, 'Fase 1 · Retirada')).toBeFocused();
});

test('archives a phase and undoes it', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição', 'Piso');

  await phaseMenu(page, 'Demolição', 'Arquivar');

  await expect(page.getByText('Fase arquivada')).toBeVisible();
  await expect(phaseButton(page, 'Fase 1 · Piso')).toBeVisible();
  await expect(index(page).getByText(/Demolição/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Desfazer' }).click();

  await expect(phaseButton(page, 'Fase 1 · Demolição')).toBeVisible();
  await expect(phaseButton(page, 'Fase 2 · Piso')).toBeVisible();
});

test('deletes the filtered phase, which clears the filter, and undo re-applies it', async ({
  page,
}) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição', 'Piso');
  await phaseButton(page, 'Fase 2 · Piso').click();
  await expect(page).toHaveURL(/fase=/);

  await phaseMenu(page, 'Piso', 'Excluir');

  await expect(page.getByText('Fase excluída')).toBeVisible();
  await expect(page).not.toHaveURL(/fase=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(page).toHaveURL(/fase=/);
});

test('lists, filters and creates phases in the panel', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição');
  await page.getByRole('heading', { level: 1 }).getByRole('button', { name: 'Reforma' }).click();
  const panel = page.getByRole('complementary', { name: 'Iniciativa' });

  await expect(panel.getByRole('button', { name: 'Fase 1 · Demolição' })).toBeVisible();
  await panel.getByRole('button', { name: '+ Nova fase' }).click();
  await panel.getByLabel('Nome da nova fase').fill('Piso');
  await panel.getByLabel('Nome da nova fase').press('Enter');
  await expect(panel.getByRole('button', { name: 'Fase 2 · Piso' })).toBeVisible();

  await panel.getByRole('button', { name: 'Fase 2 · Piso' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  await expect(page).toHaveURL(/detalhes=1/);
});

test('counts the phases in the archive notice of the initiative', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createPhases(page, 'Demolição', 'Piso');

  await index(page).getByRole('button', { name: 'Ações de Reforma' }).click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();

  await expect(page.getByText('Iniciativa arquivada, com 2 fases')).toBeVisible();
});
