import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { card, reforma, sand, world } from '@/test/task-world';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 17, 12));
  navigateTo(`/?iniciativa=${reforma.id}`);
});

afterEach(() => {
  vi.useRealTimers();
  navigateTo('/');
});

async function renderBoard() {
  const tasks = serveTaskApi(world);
  const planner = servePlannerApi({}, tasks);
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('article', { name: 'Comprar tinta' });
  return { planner, user: userEvent.setup() };
}

describe('"Pôr na lista de hoje" on the board', () => {
  it('puts the task in the list of today, hides the item afterwards and can be undone', async () => {
    const { planner, user } = await renderBoard();

    await user.click(
      within(card('Lixar parede')).getByRole('button', { name: 'Ações da tarefa Lixar parede' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Pôr na lista de hoje' }));

    await waitFor(() => {
      expect(planner.bodies).toEqual([{ taskId: sand.id, date: '2026-11-17' }]);
    });
    expect(await screen.findByText('Tarefa na lista de hoje')).toBeVisible();

    await user.click(
      within(card('Lixar parede')).getByRole('button', { name: 'Ações da tarefa Lixar parede' }),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Pôr na lista de hoje' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(planner.items).toEqual([]);
    });
  });

  it('is not offered for a done task', async () => {
    navigateTo('/');
    const { user } = await renderBoard();

    await user.click(
      within(card('Plantar alface')).getByRole('button', {
        name: 'Ações da tarefa Plantar alface',
      }),
    );

    expect(await screen.findByRole('menuitem', { name: 'Editar título' })).toBeVisible();
    expect(
      screen.queryByRole('menuitem', { name: 'Pôr na lista de hoje' }),
    ).not.toBeInTheDocument();
  });
});
