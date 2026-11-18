import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoSeriousViolations } from './axe';
import { seedInitiative, type World } from './api-seed';
import { resetDatabase } from './reset-database';

// A fixed Friday morning in a fixed zone: the review is about 16 to 22 November.
const NOW = '2026-11-20T10:30:00-03:00';
const WEEK = '2026-11-16';
const NEXT_WEEK = '2026-11-23';

test.use({ timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.clock.setFixedTime(new Date(NOW));
});

async function seed(page: Page): Promise<World> {
  return seedInitiative(page.request, 'Reforma', [
    { title: 'Pintar sala', changes: { status: 'done', plannedWeekStart: WEEK } },
    {
      title: 'Lixar parede',
      changes: { priority: 'P1', estimatedEffort: 4, plannedWeekStart: WEEK },
    },
    { title: 'Comprar tinta', changes: { priority: 'P1', estimatedEffort: 1 } },
    { title: 'Instalar torneira', changes: { priority: 'P3', estimatedEffort: 2 } },
  ]);
}

function summary(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

function plan(page: Page): Locator {
  return page.getByRole('region', { name: 'A próxima semana', exact: true });
}

function answer(page: Page, question: string): Locator {
  return page.getByRole('textbox', { name: question, exact: true });
}

function row(page: Page, title: string): Locator {
  return page.getByRole('checkbox', { name: title, exact: true });
}

test('opens the review of the week that is about to end', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');

  await expect(page.getByText('Introspecto · semana 47', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: '16 a 22 de novembro', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Ainda não começada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Introspecto', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('button', { name: 'Próxima semana', exact: true })).toBeDisabled();
});

test('keeps an answer after a reload', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');

  await answer(page, 'O que foi bom?').fill('Terminei a sala.');
  await expect(page.getByText(/^Rascunho salvo às \d{2}:\d{2}$/)).toBeVisible();
  await page.reload();

  await expect(answer(page, 'O que foi bom?')).toHaveValue('Terminei a sala.');
  await expect(answer(page, 'O que foi ruim?')).toHaveValue('');
  await expect(page.getByText(/^Rascunho salvo às \d{2}:\d{2}$/)).toBeVisible();
});

test('shows what was done and what was left behind', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');

  await expect(summary(page, 'Concluídas · 1')).toContainText('Pintar sala');
  await expect(summary(page, 'Ficaram para trás · 1')).toContainText('Lixar parede');
  await expect(summary(page, 'Ficaram para trás · 1')).not.toContainText('Pintar sala');
});

test('plans a task for the next week and finds it first in the planner tray', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');
  await expect(plan(page).getByText('Nada marcado ainda', { exact: true })).toBeVisible();

  const saved = page.waitForResponse(
    (response) => response.url().includes('/api/tasks/') && response.request().method() === 'PATCH',
  );
  await row(page, 'Instalar torneira').click();
  await expect(row(page, 'Instalar torneira')).toBeChecked();
  await expect(plan(page).getByText('1 tarefa · 2h', { exact: true })).toBeVisible();
  await saved;

  await page.goto(`/semana?semana=${NEXT_WEEK}`);
  const tray = page.getByRole('complementary', { name: 'Para planejar', exact: true });
  await expect(tray.getByRole('article').first()).toHaveAccessibleName('Instalar torneira');
  await expect(tray.getByRole('article')).toHaveCount(3);
});

test('unchecks a planned task and clears the week', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');

  await row(page, 'Comprar tinta').click();
  await expect(row(page, 'Comprar tinta')).toBeChecked();
  await page.reload();
  await expect(row(page, 'Comprar tinta')).toBeChecked();

  await row(page, 'Comprar tinta').click();
  await expect(row(page, 'Comprar tinta')).not.toBeChecked();
  await page.reload();
  await expect(row(page, 'Comprar tinta')).not.toBeChecked();
});

test('closes the sheet, which becomes read-only', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');
  await answer(page, 'Como posso melhorar?').fill('Planejar com folga.');

  await page.getByRole('button', { name: 'Fechar o Introspecto', exact: true }).click();

  await expect(page.getByText(/^Fechada em /)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Como posso melhorar?', exact: true }),
  ).toContainText('Planejar com folga.');
  await expect(page.getByRole('button', { name: 'Fechar o Introspecto', exact: true })).toHaveCount(
    0,
  );
  await expect(row(page, 'Instalar torneira')).toBeDisabled();

  await page.reload();
  await expect(page.getByText(/^Fechada em /)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(row(page, 'Instalar torneira')).toBeDisabled();
});

test('moves to the previous week and back', async ({ page }) => {
  await seed(page);
  await page.goto('/introspecto');

  await page.getByRole('button', { name: 'Semana anterior', exact: true }).click();

  await expect(page).toHaveURL(/semana=2026-11-09$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '9 a 15 de novembro', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Próxima semana', exact: true }).click();
  await expect(page).not.toHaveURL(/semana=/);
  await expect(
    page.getByRole('heading', { level: 1, name: '16 a 22 de novembro', exact: true }),
  ).toBeVisible();
});

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 800 }, touch: false },
  { name: 'phone', size: { width: 390, height: 844 }, touch: true },
] as const;

for (const { name, size, touch } of VIEWPORTS) {
  test.describe(`at ${name} size`, () => {
    test.use({ viewport: size, hasTouch: touch });

    test('the open sheet has no serious violations', async ({ page }) => {
      await seed(page);
      await page.goto('/introspecto');
      await expect(row(page, 'Instalar torneira')).toBeVisible();
      await row(page, 'Comprar tinta').click();
      await expect(row(page, 'Comprar tinta')).toBeChecked();

      await expectNoSeriousViolations(page);
    });

    test('the closed sheet has no serious violations', async ({ page }) => {
      await seed(page);
      await page.goto('/introspecto');
      await answer(page, 'O que foi bom?').fill('Terminei a sala.');
      await page.getByRole('button', { name: 'Fechar o Introspecto', exact: true }).click();
      await expect(page.getByText(/^Fechada em /)).toBeVisible();

      await expectNoSeriousViolations(page);
    });
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('keeps the total above the bottom bar', async ({ page }) => {
    await seed(page);
    await page.goto('/introspecto');
    await row(page, 'Comprar tinta').tap();

    const total = page.getByText('Na semana', { exact: true }).locator('..');
    await expect(total).toContainText('1 tarefa · 1h');
    const nav = page.getByRole('navigation', { name: 'Seções', exact: true });
    const totalBox = await total.boundingBox();
    const navBox = await nav.boundingBox();
    if (!totalBox || !navBox) throw new Error('The total and the bar must be on screen.');
    expect(totalBox.y + totalBox.height).toBeLessThanOrEqual(navBox.y);
    await expect(nav.getByRole('link', { name: 'Introspecto', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
