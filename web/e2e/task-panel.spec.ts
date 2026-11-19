import { expect, test, type Locator, type Page } from '@playwright/test';
import { resetDatabase } from './reset-database';

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.goto('/');
});

async function createInitiative(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Nova iniciativa', exact: true }).click();
  await page.getByLabel('Nome da nova iniciativa', { exact: true }).fill(name);
  await page.getByLabel('Nome da nova iniciativa', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

function card(page: Page, title: string) {
  return page.getByRole('article', { name: title, exact: true });
}

async function createTask(page: Page, title: string) {
  const column = page.getByRole('region', { name: 'A fazer', exact: true });
  await column.getByRole('button', { name: '+ Nova tarefa', exact: true }).click();
  const field = column.getByLabel('Título da nova tarefa', { exact: true });
  await field.fill(title);
  await field.press('Enter');
  await expect(column.getByRole('article', { name: title, exact: true })).toBeVisible();
  await field.press('Escape');
}

function panel(page: Page) {
  return page.getByRole('complementary', { name: 'Tarefa', exact: true });
}

function group(page: Page, name: string): Locator {
  return panel(page).getByRole('group', { name, exact: true });
}

async function seed(page: Page) {
  await createInitiative(page, 'Reforma');
  await createTask(page, 'Comprar tinta');
  await createTask(page, 'Lixar parede');
}

test('opens by click and by Enter, and closes with Esc', async ({ page }) => {
  await seed(page);

  await card(page, 'Comprar tinta').click();
  await expect(panel(page)).toBeVisible();
  await expect(card(page, 'Comprar tinta')).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(/tarefa=/);

  await panel(page).focus();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/tarefa=/);

  await card(page, 'Lixar parede').focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
  await expect(
    panel(page).getByRole('textbox', { name: 'Título da tarefa', exact: true }),
  ).toHaveValue('Lixar parede');
});

test('edits the title, state, priority, deadline, effort and week', async ({ page }) => {
  await seed(page);
  await card(page, 'Comprar tinta').click();

  const title = panel(page).getByRole('textbox', { name: 'Título da tarefa', exact: true });
  await title.fill('Comprar tinta branca');
  await title.press('Enter');
  await expect(card(page, 'Comprar tinta branca')).toBeVisible();

  await panel(page).getByRole('button', { name: 'Estado: A fazer', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Em andamento', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Em andamento', exact: true })
      .getByRole('article', { name: 'Comprar tinta branca', exact: true }),
  ).toBeVisible();

  await panel(page).getByRole('radio', { name: 'P1', exact: true }).click();
  await expect(panel(page).getByRole('radio', { name: 'P1', exact: true })).toBeChecked();

  await panel(page)
    .getByRole('button', { name: /^Prazo:/ })
    .click();
  await panel(page).getByLabel('Prazo', { exact: true }).fill('2099-12-18');
  await panel(page).getByLabel('Prazo', { exact: true }).press('Enter');
  await expect(
    panel(page).getByRole('button', { name: 'Prazo: vence sex, 18 dez 2099', exact: true }),
  ).toBeVisible();

  const effort = panel(page).getByRole('textbox', { name: 'Esforço', exact: true });
  await effort.fill('1,5');
  await effort.press('Enter');
  await expect(effort).toHaveValue('1,5h');
  await effort.fill('abc');
  await effort.press('Enter');
  await expect(
    panel(page).getByText('Use de 0,01 a 999 horas, com até 2 casas decimais.', { exact: true }),
  ).toBeVisible();
  await expect(effort).toHaveValue('1,5h');

  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.ok(),
  );
  await group(page, 'Semana').getByRole('button', { name: 'Esta semana', exact: true }).click();
  await saved;
  await expect(group(page, 'Semana').getByText(/^Planejada na semana \d+/)).toBeVisible();

  await page.reload();
  await expect(panel(page).getByRole('textbox', { name: 'Esforço', exact: true })).toHaveValue(
    '1,5h',
  );
  await expect(group(page, 'Semana').getByText(/^Planejada na semana \d+/)).toBeVisible();
});

test('moves a task between epics of its initiative', async ({ page }) => {
  await seed(page);
  const index = page.getByRole('navigation', { name: 'Iniciativas', exact: true });
  await index.getByRole('button', { name: 'Ações de Reforma', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Novo épico', exact: true }).click();
  const epic = index.getByLabel('Nome do novo épico', { exact: true });
  await epic.fill('Demolição');
  await epic.press('Enter');
  await expect(
    index.getByRole('button', { name: 'Épico 1 · Demolição', exact: true }),
  ).toBeVisible();

  await card(page, 'Comprar tinta').click();
  await panel(page).getByRole('button', { name: 'Épico: Sem épico', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Épico 1 · Demolição', exact: true }).click();

  await expect(
    panel(page).getByRole('button', { name: 'Épico: Épico 1 · Demolição', exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole('link', { name: 'Épico 1 · Demolição', exact: true }),
  ).toBeVisible();
});

test('autosaves the description, which survives a reload', async ({ page }) => {
  await seed(page);
  await card(page, 'Comprar tinta').click();

  await panel(page)
    .getByRole('textbox', { name: 'Descrição', exact: true })
    .fill('Duas latas de branco.');
  await page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.ok(),
  );

  await page.reload();
  await expect(panel(page).getByRole('textbox', { name: 'Descrição', exact: true })).toHaveValue(
    'Duas latas de branco.',
  );
});

test('adds and removes a blocker and refuses a cycle', async ({ page }) => {
  await seed(page);
  await createTask(page, 'Pintar teto');
  await card(page, 'Comprar tinta').click();

  const blocks = group(page, 'Bloqueia');
  const search = blocks.getByRole('combobox', { name: 'Buscar tarefa para bloquear', exact: true });
  const add = blocks.getByRole('button', { name: '+ Adicionar', exact: true });
  const titleField = panel(page).getByRole('textbox', { name: 'Título da tarefa', exact: true });

  await add.click();
  await search.fill('lixar');
  await page.keyboard.press('Enter');
  await expect(blocks.getByRole('button', { name: 'Lixar parede', exact: true })).toBeVisible();
  await expect(card(page, 'Comprar tinta').getByText('bloqueia 1', { exact: true })).toBeVisible();
  await expect(card(page, 'Lixar parede').getByText('esperando 1', { exact: true })).toBeVisible();

  await blocks.getByRole('button', { name: 'Lixar parede', exact: true }).click();
  await expect(titleField).toHaveValue('Lixar parede');
  await add.click();
  await search.fill('tinta');
  await expect(blocks.getByText('Nenhuma tarefa encontrada.', { exact: true })).toBeVisible();
  await search.fill('teto');
  await page.keyboard.press('Enter');
  await expect(blocks.getByRole('button', { name: 'Pintar teto', exact: true })).toBeVisible();

  await blocks.getByRole('button', { name: 'Pintar teto', exact: true }).click();
  await expect(titleField).toHaveValue('Pintar teto');
  await add.click();
  await search.fill('tinta');
  await page.keyboard.press('Enter');
  await expect(
    blocks.getByText('Isso criaria um ciclo: a outra tarefa já depende desta.', { exact: true }),
  ).toBeVisible();

  await group(page, 'Bloqueada por')
    .getByRole('button', { name: 'Remover Lixar parede', exact: true })
    .click();
  await expect(card(page, 'Pintar teto').getByText('esperando 1', { exact: true })).toHaveCount(0);
});
