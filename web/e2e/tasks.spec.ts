import { expect, test, type Page } from '@playwright/test';
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

function column(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true });
}

function card(page: Page, title: string) {
  return page.getByRole('article', { name: title, exact: true });
}

// The keys only count once dnd-kit has measured the columns, which its announcements reflect.
function announcement(page: Page) {
  return page.locator('[id^="DndLiveRegion"]');
}

async function createTask(page: Page, columnName: string, title: string) {
  await column(page, columnName)
    .getByRole('button', { name: '+ Nova tarefa', exact: true })
    .click();
  const field = column(page, columnName).getByLabel('Título da nova tarefa', { exact: true });
  await field.fill(title);
  await field.press('Enter');
  await expect(
    column(page, columnName).getByRole('article', { name: title, exact: true }),
  ).toBeVisible();
  await field.press('Escape');
}

async function taskMenu(
  page: Page,
  title: string,
  role: 'menuitem' | 'menuitemradio',
  item: string,
) {
  await card(page, title)
    .getByRole('button', { name: `Ações da tarefa ${title}`, exact: true })
    .click();
  await page.getByRole(role, { name: item, exact: true }).click();
}

test('creates a task in "A fazer", changes its priority and moves it by the menu', async ({
  page,
}) => {
  await createInitiative(page, 'Reforma');

  await createTask(page, 'A fazer', 'Comprar tinta');
  await expect(card(page, 'Comprar tinta').getByText('P2', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'A fazer · 1', exact: true }),
  ).toBeVisible();

  await taskMenu(page, 'Comprar tinta', 'menuitemradio', 'P1');
  await expect(card(page, 'Comprar tinta').getByText('P1', { exact: true })).toBeVisible();

  await taskMenu(page, 'Comprar tinta', 'menuitemradio', 'Em andamento');
  await expect(
    column(page, 'Em andamento').getByRole('article', { name: 'Comprar tinta', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Tarefa movida para Em andamento', { exact: true })).toBeVisible();
});

test('drags a card to "Feito"', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createTask(page, 'A fazer', 'Lixar parede');

  const source = await card(page, 'Lixar parede').boundingBox();
  const target = await column(page, 'Feito').boundingBox();
  if (!source || !target) throw new Error('The card and the column must be on screen.');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 12 });
  await page.mouse.up();

  await expect(
    column(page, 'Feito').getByRole('article', { name: 'Lixar parede', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Tarefa movida para Feito', { exact: true })).toBeVisible();
});

test('blocks a task and archives it with undo', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createTask(page, 'A fazer', 'Pedir orçamento');

  await taskMenu(page, 'Pedir orçamento', 'menuitem', 'Marcar como bloqueada');
  await expect(card(page, 'Pedir orçamento').getByText('Bloqueada', { exact: true })).toBeVisible();

  await taskMenu(page, 'Pedir orçamento', 'menuitem', 'Arquivar');
  await expect(card(page, 'Pedir orçamento')).toHaveCount(0);
  await expect(page.getByText('Tarefa arquivada', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(card(page, 'Pedir orçamento')).toBeVisible();
  await expect(card(page, 'Pedir orçamento').getByText('Bloqueada', { exact: true })).toBeVisible();
});

test('creates a task from "Todas as tarefas" choosing the initiative', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createInitiative(page, 'Horta');
  await page
    .getByRole('navigation', { name: 'Iniciativas', exact: true })
    .getByRole('button', { name: 'Todas as tarefas', exact: true })
    .click();

  await column(page, 'A fazer').getByRole('button', { name: '+ Nova tarefa', exact: true }).click();
  await column(page, 'A fazer')
    .getByLabel('Iniciativa da nova tarefa', { exact: true })
    .selectOption({ label: 'Horta' });
  const field = column(page, 'A fazer').getByLabel('Título da nova tarefa', { exact: true });
  await field.fill('Plantar alface');
  await field.press('Enter');

  const created = card(page, 'Plantar alface');
  await expect(created).toBeVisible();
  await expect(created.getByText('Horta', { exact: true })).toBeVisible();

  await page.reload();
  await column(page, 'A fazer').getByRole('button', { name: '+ Nova tarefa', exact: true }).click();
  await expect(
    column(page, 'A fazer').getByLabel('Iniciativa da nova tarefa', { exact: true }),
  ).toHaveValue(/.+/);
  await expect(
    column(page, 'A fazer')
      .getByLabel('Iniciativa da nova tarefa', { exact: true })
      .locator('option:checked'),
  ).toHaveText('Horta');
});

test('moves a card to "Em andamento" with the keyboard', async ({ page }) => {
  await createInitiative(page, 'Reforma');
  await createTask(page, 'A fazer', 'Rejuntar');

  await card(page, 'Rejuntar').focus();
  await page.keyboard.press('Space');
  await expect(announcement(page)).toContainText('Rejuntar está sobre a coluna A fazer');
  // dnd-kit binds its key listener a moment after the pickup is announced,
  // so an early arrow can be lost.
  let overshot = false;
  await expect(async () => {
    const said = await announcement(page).innerText();
    overshot = said.includes('Feito');
    // Both arrows landed: retrying would only hide it.
    if (overshot) return;
    if (!said.includes('Em andamento')) await page.keyboard.press('ArrowRight');
    await expect(announcement(page)).toContainText('está sobre a coluna Em andamento', {
      timeout: 1000,
    });
  }).toPass();
  expect(overshot, 'Both arrows landed: the card went past "Em andamento".').toBe(false);
  await page.keyboard.press('Space');

  await expect(
    column(page, 'Em andamento').getByRole('article', { name: 'Rejuntar', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Tarefa movida para Em andamento', { exact: true })).toBeVisible();
});
