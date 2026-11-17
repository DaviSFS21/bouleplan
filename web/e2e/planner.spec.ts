import { expect, test, type Locator, type Page } from '@playwright/test';
import { resetDatabase } from './reset-database';

const HOUR_PX = 48;

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.goto('/');
});

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

const TODAY = isoDate(new Date());

// The agenda shows 8h to 18h, widened to hold the now line.
const FIRST_HOUR = Math.min(8, new Date().getHours());

function today(page: Page): Locator {
  return page.locator(`[data-day="${TODAY}"]`);
}

function todayList(page: Page): Locator {
  return page.locator(`[data-strip="${TODAY}"]`);
}

function tray(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Para planejar', exact: true });
}

function trayItem(page: Page, title: string): Locator {
  return tray(page).getByRole('article', { name: title, exact: true });
}

function panel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Tarefa', exact: true });
}

async function createInitiative(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Nova iniciativa', exact: true }).click();
  await page.getByLabel('Nome da nova iniciativa', { exact: true }).fill(name);
  await page.getByLabel('Nome da nova iniciativa', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

interface Seed {
  title: string;
  effort?: string;
  deadline?: string;
}

async function seed(page: Page, tasks: Seed[]) {
  await createInitiative(page, 'Reforma');
  const column = page.getByRole('region', { name: 'A fazer', exact: true });
  for (const { title, effort, deadline } of tasks) {
    await column.getByRole('button', { name: '+ Nova tarefa', exact: true }).click();
    const field = column.getByLabel('Título da nova tarefa', { exact: true });
    await field.fill(title);
    await field.press('Enter');
    await expect(column.getByRole('article', { name: title, exact: true })).toBeVisible();
    await field.press('Escape');

    await column.getByRole('article', { name: title, exact: true }).click();
    await expect(panel(page)).toBeVisible();
    if (effort) {
      const box = panel(page).getByRole('textbox', { name: 'Esforço', exact: true });
      await box.fill(effort);
      await box.press('Enter');
      await expect(box).toHaveValue(`${effort}h`);
    }
    if (deadline) {
      await panel(page)
        .getByRole('button', { name: /^Prazo:/ })
        .click();
      await panel(page).getByLabel('Prazo', { exact: true }).fill(deadline);
      await panel(page).getByLabel('Prazo', { exact: true }).press('Enter');
      await expect(panel(page).getByRole('button', { name: /^Prazo: vence/ })).toBeVisible();
    }
    await panel(page).getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
  }
}

async function openWeek(page: Page) {
  await page.getByRole('tab', { name: 'Semana', exact: true }).click();
  await expect(page).toHaveURL(/\/semana/);
  await expect(
    page.getByRole('complementary', { name: 'Para planejar', exact: true }),
  ).toBeVisible();
}

async function dragTo(page: Page, source: Locator, x: number, y: number) {
  const box = await source.boundingBox();
  if (!box) throw new Error('The dragged element must be on screen.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

// A point in today's column, at the given hour of the day.
async function atHour(page: Page, hour: number): Promise<{ x: number; y: number }> {
  const box = await today(page).boundingBox();
  if (!box) throw new Error('Today must be on screen.');
  return { x: box.x + box.width / 2, y: box.y + (hour - FIRST_HOUR) * HOUR_PX + 4 };
}

async function dropOnHour(page: Page, source: Locator, hour: number) {
  const target = await atHour(page, hour);
  await dragTo(page, source, target.x, target.y);
}

function block(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true });
}

test('navigates to the week', async ({ page }) => {
  await seed(page, [{ title: 'Comprar tinta' }]);

  await openWeek(page);

  await expect(page.getByText(/^Semana \d+$/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Semana', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(trayItem(page, 'Comprar tinta')).toBeVisible();
});

test('adds a task to the list of a day by dragging it, and to today by the menu', async ({
  page,
}) => {
  await seed(page, [{ title: 'Comprar tinta' }, { title: 'Lixar parede' }]);
  await openWeek(page);

  const list = await todayList(page).boundingBox();
  if (!list) throw new Error("Today's list must be on screen.");
  await dragTo(page, trayItem(page, 'Comprar tinta'), list.x + list.width / 2, list.y + 20);
  await expect(
    todayList(page).getByRole('article', { name: 'Comprar tinta', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Tarefa na lista de hoje', { exact: true })).toBeVisible();

  await trayItem(page, 'Lixar parede')
    .getByRole('button', { name: 'Ações da tarefa Lixar parede', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Pôr na lista de hoje', exact: true }).click();
  await expect(
    todayList(page).getByRole('article', { name: 'Lixar parede', exact: true }),
  ).toBeVisible();
  await expect(todayList(page)).toContainText('sem horário');
});

test('turns a ficha into a block, then moves and resizes it', async ({ page }) => {
  await seed(page, [{ title: 'Comprar tinta', effort: '2' }]);
  await openWeek(page);
  await trayItem(page, 'Comprar tinta')
    .getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Pôr na lista de hoje', exact: true }).click();
  const ficha = todayList(page).getByRole('article', { name: 'Comprar tinta', exact: true });
  await expect(ficha).toBeVisible();

  await dropOnHour(page, ficha, 9);

  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();
  await expect(todayList(page).getByRole('article')).toHaveCount(0);

  const moving = block(page, 'Comprar tinta, 9:00 – 11:00');
  const box = await moving.boundingBox();
  if (!box) throw new Error('The block must be on screen.');
  await dragTo(page, moving, box.x + box.width / 2, box.y + box.height / 2 + HOUR_PX * 2);
  await expect(block(page, 'Comprar tinta, 11:00 – 13:00')).toBeVisible();

  const handle = page.locator('[data-resize-handle]');
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('The handle must be on screen.');
  await dragTo(page, handle, handleBox.x + 4, handleBox.y + handleBox.height / 2 + HOUR_PX / 2);
  await expect(block(page, 'Comprar tinta, 11:00 – 13:30')).toBeVisible();
});

test('refuses a block over another one', async ({ page }) => {
  await seed(page, [
    { title: 'Comprar tinta', effort: '2' },
    { title: 'Lixar parede', effort: '1' },
  ]);
  await openWeek(page);
  await dropOnHour(page, trayItem(page, 'Comprar tinta'), 9);
  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();

  const target = await atHour(page, 10);
  const source = await trayItem(page, 'Lixar parede').boundingBox();
  if (!source) throw new Error('The task must be on screen.');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await expect(
    page.getByText('não cabe aqui · já há tempo reservado', { exact: true }),
  ).toBeVisible();
  await page.mouse.up();

  await expect(page.getByRole('group', { name: /^Lixar parede, / })).toHaveCount(0);
  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();
});

test('creates a fixed event by dragging, and deletes it with undo', async ({ page }) => {
  await seed(page, [{ title: 'Comprar tinta' }]);
  await openWeek(page);

  const from = await atHour(page, 13);
  const to = await atHour(page, 14.5);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  const title = page.getByRole('textbox', { name: 'Título do compromisso', exact: true });
  await expect(title).toBeFocused();
  await title.fill('Reunião');
  await title.press('Enter');

  const event = page.getByRole('button', { name: /^Reunião, 13:00/ });
  await expect(event).toBeVisible();

  await event.click();
  const popover = page.getByRole('dialog', { name: 'Compromisso', exact: true });
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Reunião, / })).toHaveCount(0);

  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Reunião, 13:00/ })).toBeVisible();
});

test('warns about a deadline without reserved time until the effort is reserved', async ({
  page,
}) => {
  await seed(page, [{ title: 'Comprar tinta', effort: '2', deadline: TODAY }]);
  await openWeek(page);

  const notice = page.getByRole('status').filter({ hasText: 'Prazos sem tempo reservado.' });
  await expect(notice).toContainText('1 tarefa vence nesta semana com tempo a reservar.');
  await expect(trayItem(page, 'Comprar tinta')).toContainText('faltam 2h');
  await expect(
    page.getByRole('button', { name: /^prazo · Comprar tinta · faltam 2h/ }),
  ).toBeVisible();

  await dropOnHour(page, trayItem(page, 'Comprar tinta'), 9);

  await expect(block(page, 'Comprar tinta, 9:00 – 11:00')).toBeVisible();
  await expect(page.getByText('Prazos sem tempo reservado.', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'prazo · Comprar tinta', exact: true }),
  ).toBeVisible();
});
