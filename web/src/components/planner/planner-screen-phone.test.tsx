import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import { NOW, agenda, block, entry, plannerWorld, strip } from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { PHONE, TABLET, setViewport } from '@/test/viewport';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/semana');
});

afterEach(() => {
  navigateTo('/');
});

async function renderWeek(viewport: typeof PHONE | typeof TABLET = PHONE, url = '/semana') {
  setViewport(viewport);
  navigateTo(url);
  const taskBackend = serveTaskApi(plannerWorld);
  servePlannerApi(
    {
      items: [
        block(),
        entry(),
        entry({ id: 'e0000000-0000-4000-8000-0000000000c2', date: '2026-11-19' }),
      ],
    },
    taskBackend,
  );
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  return userEvent.setup();
}

function dayTab(name: RegExp | string) {
  return screen.getByRole('tab', { name });
}

describe('the day strip on a phone', () => {
  it('lists the seven days as tabs and opens on today', async () => {
    await renderWeek();

    expect(screen.getByRole('tablist', { name: 'Dias da semana' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(dayTab(/terça-feira.*hoje/)).toHaveAttribute('aria-selected', 'true');
    expect(dayTab(/terça-feira/).textContent).toBe('17 Ter');
  });

  it('marks only today with the today class', async () => {
    await renderWeek();

    expect(dayTab(/terça-feira/).className).toContain('todayTab');
    expect(dayTab(/quarta-feira/).className).not.toContain('todayTab');
  });

  it('shows one day at a time, as the tabpanel of the selected tab', async () => {
    await renderWeek();

    const panel = screen.getByRole('tabpanel', { name: /terça-feira/ });
    expect(within(panel).getByRole('group', { name: /terça-feira/ })).toBe(agenda('2026-11-17'));
    expect(document.querySelector('[data-day="2026-11-18"]')).toBeNull();
    expect(document.querySelectorAll('[data-day]')).toHaveLength(1);
  });

  it('switches the day with a tap, showing its list', async () => {
    const user = await renderWeek();

    await user.click(dayTab(/quarta-feira/));

    expect(dayTab(/quarta-feira/)).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-day="2026-11-17"]')).toBeNull();
    expect(
      within(strip('2026-11-18')).getByRole('article', { name: 'Lixar parede' }),
    ).toBeVisible();
  });

  it('switches with the arrow keys', async () => {
    const user = await renderWeek();
    dayTab(/terça-feira/).focus();

    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(dayTab(/quinta-feira/)).toHaveFocus();
    expect(dayTab(/quinta-feira/)).toHaveAttribute('aria-selected', 'true');
    expect(strip('2026-11-19')).toBeInTheDocument();
  });

  it('opens on the first day of a week that does not hold today', async () => {
    await renderWeek(PHONE, '/semana?semana=2026-11-23');

    expect(dayTab(/segunda-feira/)).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('[data-day]')).toHaveLength(1);
  });

  it('is absent on a tablet, which shows the seven days', async () => {
    await renderWeek(TABLET);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-day]')).toHaveLength(7);
  });
});

describe('the week on a touch screen', () => {
  it('does not draw an event by pressing and dragging on empty time', async () => {
    const user = await renderWeek();

    await user.pointer([
      { keys: '[MouseLeft>]', target: agenda('2026-11-17') },
      { pointerName: 'mouse', target: agenda('2026-11-17'), coords: { y: 90 } },
      { keys: '[/MouseLeft]' },
    ]);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps the alert without the "Mostrar na bandeja" action, since the tray is hidden', async () => {
    await renderWeek();

    expect(screen.getByText(/vence nesta semana|vencem nesta semana/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar na bandeja' })).not.toBeInTheDocument();
  });

  it('shows the alert action on a desktop', async () => {
    setViewport({ width: 1440, coarse: false });
    const taskBackend = serveTaskApi(plannerWorld);
    servePlannerApi({}, taskBackend);
    renderWithQuery(<PlannerScreen now={NOW} />);

    expect(await screen.findByRole('button', { name: 'Mostrar na bandeja' })).toBeVisible();
  });

  it('takes a ficha off the list through its menu, since the "×" is not shown on touch', async () => {
    const user = await renderWeek();
    await user.click(dayTab(/quarta-feira/));

    await user.click(
      within(strip('2026-11-18')).getByRole('button', { name: 'Ações da tarefa Lixar parede' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Tirar da lista' }));

    await waitFor(() => {
      expect(within(strip('2026-11-18')).queryByRole('article')).not.toBeInTheDocument();
    });
  });

  it('gives focus to the tab of the target day when a block leaves the day in view', async () => {
    const user = await renderWeek();
    await user.click(screen.getByRole('button', { name: 'Comprar tinta, 9:00 – 11:00' }));
    const dialog = await screen.findByRole('dialog', { name: 'Comprar tinta' });

    await user.selectOptions(within(dialog).getByLabelText('Dia'), '2026-11-19');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(dayTab(/quinta-feira/)).toHaveFocus();
    });
    expect(screen.getByRole('status', { name: 'Movimentos da agenda' })).toHaveTextContent(
      'Bloco movido para qui, 9:00–11:00.',
    );
  });
});
