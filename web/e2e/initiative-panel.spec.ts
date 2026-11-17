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

function initiativeItem(page: Page, name: string) {
  return index(page).getByRole('button', { name: new RegExp(`^${name}`) });
}

function panel(page: Page) {
  return page.getByRole('complementary', { name: 'Iniciativa' });
}

async function openPanel(page: Page, name: string) {
  await page.getByRole('heading', { level: 1 }).getByRole('button', { name }).click();
  await expect(panel(page)).toBeVisible();
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

function patched(page: Page, action: () => Promise<void>) {
  return Promise.all([
    page.waitForResponse((response) => response.request().method() === 'PATCH' && response.ok()),
    action(),
  ]);
}

test('renames the initiative from the panel', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');
  const title = panel(page).getByRole('textbox', { name: 'Nome da iniciativa' });

  await title.fill('Horta urbana');
  await patched(page, () => title.press('Enter'));

  await expect(initiativeItem(page, 'Horta urbana')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Horta urbana' })).toBeVisible();
});

test('shows the blank-name message and keeps the old name', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');
  const title = panel(page).getByRole('textbox', { name: 'Nome da iniciativa' });

  await title.fill('');
  await title.press('Enter');

  await expect(panel(page).getByRole('alert')).toHaveText('Dê um nome à iniciativa.');
  await expect(title).toHaveValue('Horta');
});

test('changes the color and updates the index dot', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');

  await panel(page).getByRole('button', { name: 'Amarelo', expanded: false }).click();
  await patched(page, () => panel(page).getByRole('radio', { name: 'Roxo' }).click());

  await expect(panel(page).getByRole('button', { name: 'Roxo', expanded: false })).toBeFocused();
  await expect(panel(page).getByRole('radiogroup')).toBeHidden();
  await expect
    .poll(async () => {
      const { actual, expected } = await dotColors(page, 'Horta', '--ini-roxo');
      return actual === expected;
    })
    .toBe(true);
});

test('sets a deadline', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');

  await panel(page).getByRole('button', { name: 'Prazo geral: sem prazo' }).click();
  const input = panel(page).getByLabel('Prazo geral');
  await input.fill('2099-12-18');
  await patched(page, () => input.press('Enter'));

  await expect(
    panel(page).getByRole('button', { name: /^Prazo geral: \p{L}{3}, 18 dez$/u }),
  ).toBeVisible();
});

test('keeps the description and the open panel after a reload', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');
  const description = panel(page).getByRole('textbox', { name: 'Descrição' });

  await description.fill('Canteiros e irrigação');
  await patched(page, () => description.blur());
  await page.reload();

  await expect(page).toHaveURL(/\?iniciativa=[0-9a-f-]+&detalhes=1$/);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('textbox', { name: 'Descrição' })).toHaveValue(
    'Canteiros e irrigação',
  );
});

test('closes the panel with Escape and the URL drops the details', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await openPanel(page, 'Horta');

  await page.keyboard.press('Escape');

  await expect(panel(page)).toBeHidden();
  await expect(page).not.toHaveURL(/detalhes/);
  await expect(
    page.getByRole('heading', { level: 1 }).getByRole('button', { name: 'Horta' }),
  ).toBeFocused();
});

for (const [action, message] of [
  ['Arquivar', 'Iniciativa arquivada'],
  ['Excluir', 'Iniciativa excluída'],
] as const) {
  test(`${action}: leaves at once, shows the toast and undo brings it back selected`, async ({
    page,
  }) => {
    await createInitiative(page, 'Horta');
    await openPanel(page, 'Horta');

    await panel(page).getByRole('button', { name: 'Ações da iniciativa' }).click();
    await page.getByRole('menuitem', { name: action }).click();

    await expect(page.getByRole('status')).toContainText(message);
    await expect(panel(page)).toBeHidden();
    await expect(initiativeItem(page, 'Horta')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();

    await page.getByRole('button', { name: 'Desfazer' }).click();

    await expect(initiativeItem(page, 'Horta')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('heading', { level: 1, name: 'Horta' })).toBeVisible();
    await expect(page.getByRole('status')).not.toContainText(message);
  });
}

test('archiving without undo frees the color for the next initiative', async ({ page }) => {
  await createInitiative(page, 'Horta');
  await initiativeItem(page, 'Horta').hover();
  await page.getByRole('button', { name: 'Ações de Horta' }).click();
  await page.getByRole('menuitem', { name: 'Arquivar' }).click();
  await expect(initiativeItem(page, 'Horta')).toBeHidden();

  await createInitiative(page, 'Casa');

  const { actual, expected } = await dotColors(page, 'Casa', '--ini-amarelo');
  expect(actual).toBe(expected);
});
