import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousViolations } from './axe';
import { addEvent, reserve, seedInitiative, type World } from './api-seed';
import { resetDatabase } from './reset-database';

type PanelRole = 'complementary' | 'dialog';

const NOW = '2026-11-18T10:30:00-03:00';

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 800 }, touch: false },
  { name: 'phone', size: { width: 390, height: 844 }, touch: true },
] as const;

test.use({ timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' });

async function seedBoard(page: Page): Promise<World> {
  return seedInitiative(page.request, 'Reforma', [
    {
      title: 'Comprar tinta',
      changes: { priority: 'P1', deadline: '2026-11-20', estimatedEffort: 4 },
    },
    { title: 'Lixar parede', changes: { status: 'in_progress', estimatedEffort: 2 } },
    { title: 'Pintar sala', changes: { isBlocked: true, priority: 'P3' } },
    { title: 'Pedir orçamento', changes: { status: 'done' } },
  ]);
}

// Beside the page on a desktop, a modal over it on a phone.
function panelRole(touch: boolean): PanelRole {
  return touch ? 'dialog' : 'complementary';
}

for (const { name, size, touch } of VIEWPORTS) {
  test.describe(`at ${name} size`, () => {
    test.use({ viewport: size, hasTouch: touch });

    test.beforeEach(async ({ page }) => {
      await resetDatabase();
      await page.clock.setFixedTime(new Date(NOW));
    });

    test('the empty board has no serious violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('the board with data has no serious violations', async ({ page }) => {
      const { initiativeId } = await seedBoard(page);
      await page.goto(`/?iniciativa=${initiativeId}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
      await expect(page.getByRole('article', { name: 'Comprar tinta', exact: true })).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('the open initiative panel has no serious violations', async ({ page }) => {
      const { initiativeId } = await seedBoard(page);
      await page.goto(`/?iniciativa=${initiativeId}`);
      await page
        .getByRole('heading', { level: 1 })
        .getByRole('button', { name: 'Reforma' })
        .click();
      await expect(
        page.getByRole(panelRole(touch), { name: 'Iniciativa', exact: true }),
      ).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('the open task panel has no serious violations', async ({ page }) => {
      const { initiativeId, taskIds } = await seedBoard(page);
      await page.goto(`/?iniciativa=${initiativeId}&tarefa=${taskIds['Comprar tinta'] ?? ''}`);
      await expect(page.getByRole(panelRole(touch), { name: 'Tarefa', exact: true })).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('the week with blocks, fichas and an event has no serious violations', async ({
      page,
    }) => {
      const { taskIds } = await seedBoard(page);
      await reserve(page.request, taskIds['Comprar tinta'] ?? '', '2026-11-18', {
        startTime: '09:00',
        endTime: '11:00',
      });
      await reserve(page.request, taskIds['Lixar parede'] ?? '', '2026-11-18');
      await addEvent(page.request, {
        title: 'Reunião com o arquiteto',
        date: '2026-11-18',
        startTime: '14:00',
        endTime: '15:00',
      });
      await page.goto('/semana');
      await expect(
        page.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Reunião com o arquiteto, 14:00 – 15:00', exact: true }),
      ).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('an open task menu has no serious violations', async ({ page }) => {
      const { initiativeId } = await seedBoard(page);
      await page.goto(`/?iniciativa=${initiativeId}`);
      await page
        .getByRole('button', { name: 'Ações da tarefa Comprar tinta', exact: true })
        .click();
      await expect(
        page.getByRole('menu', { name: 'Ações da tarefa Comprar tinta', exact: true }),
      ).toBeVisible();

      await expectNoSeriousViolations(page);
    });

    test('the reserve popover has no serious violations', async ({ page }) => {
      const { taskIds } = await seedBoard(page);
      await reserve(page.request, taskIds['Lixar parede'] ?? '', '2026-11-18');
      await page.goto('/semana');
      await page
        .locator('[data-strip="2026-11-18"]')
        .getByRole('button', { name: 'Ações da tarefa Lixar parede', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Reservar tempo…', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Reservar tempo', exact: true })).toBeVisible();

      await expectNoSeriousViolations(page);
    });
  });
}

test.describe('on a phone, in the tabs that are not the default', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await page.clock.setFixedTime(new Date(NOW));
  });

  test('the "Em andamento" state tab has no serious violations', async ({ page }) => {
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await page.getByRole('tab', { name: /^Em andamento/ }).click();
    await expect(page.getByRole('article', { name: 'Lixar parede', exact: true })).toBeVisible();

    await expectNoSeriousViolations(page);
  });

  test('a day tab other than today has no serious violations', async ({ page }) => {
    await seedBoard(page);
    await page.goto('/semana');
    await page.getByRole('tab', { name: /^19 Qui/ }).click();
    await expect(page.getByRole('tab', { name: /^19 Qui/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await expectNoSeriousViolations(page);
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 900, height: 1000 }, hasTouch: true });

  test('the open drawer has no serious violations', async ({ page }) => {
    await resetDatabase();
    await page.clock.setFixedTime(new Date(NOW));
    const { initiativeId } = await seedBoard(page);
    await page.goto(`/?iniciativa=${initiativeId}`);
    await page.getByRole('button', { name: 'Iniciativas', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Iniciativas', exact: true })).toBeVisible();

    await expectNoSeriousViolations(page);
  });
});
