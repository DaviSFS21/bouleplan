import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { reforma, world } from '@/test/task-world';
import { PHONE, setViewport } from '@/test/viewport';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 5, 10));
  navigateTo(`/?iniciativa=${reforma.id}`);
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  navigateTo('/');
});

async function renderPhoneBoard() {
  setViewport(PHONE);
  const backend = serveTaskApi(world);
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('article', { name: 'Comprar tinta' });
  return { backend, user: userEvent.setup() };
}

function tab(name: string) {
  return screen.getByRole('tab', { name });
}

describe('state tabs on a phone', () => {
  it('show the states with their counts and one column at a time', async () => {
    await renderPhoneBoard();

    expect(screen.getByRole('tablist', { name: 'Estados' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((item) => item.textContent)).toEqual([
      'A fazer · 3',
      'Em andamento · 1',
      'Feito · 0',
    ]);
    expect(tab('A fazer · 3')).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'A fazer · 3' });
    expect(within(panel).getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('article', { name: 'Lixar parede' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('switch the column with a tap', async () => {
    const { user } = await renderPhoneBoard();

    await user.click(tab('Em andamento · 1'));

    expect(screen.getByRole('tabpanel', { name: 'Em andamento · 1' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Lixar parede' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Comprar tinta' })).not.toBeInTheDocument();
  });

  it('switch with the arrow keys', async () => {
    const { user } = await renderPhoneBoard();
    tab('A fazer · 3').focus();

    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(tab('Feito · 0')).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Feito · 0' })).toBeInTheDocument();
  });

  it('are absent on a desktop, which shows the three columns', async () => {
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('article', { name: 'Comprar tinta' });

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(3);
  });
});

describe('moving a card on a touch screen', () => {
  it('goes through the sheet menu, and the tabs follow the card', async () => {
    const { backend, user } = await renderPhoneBoard();

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Comprar tinta' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Em andamento' }));

    expect(backend.bodies).toEqual([{ status: 'in_progress' }]);
    await waitFor(() => {
      expect(tab('Em andamento · 2')).toHaveAttribute('aria-selected', 'true');
    });
    expect(await screen.findByRole('article', { name: 'Comprar tinta' })).toHaveFocus();
    expect(await screen.findByText('Tarefa movida para Em andamento')).toBeVisible();
  });

  it('shows the card menu without hovering', async () => {
    await renderPhoneBoard();

    expect(screen.getByRole('button', { name: 'Ações da tarefa Comprar tinta' })).toBeVisible();
  });

  it('has no drag sensors, not even the keyboard one', async () => {
    const { user } = await renderPhoneBoard();
    screen.getByRole('article', { name: 'Comprar tinta' }).focus();

    await user.keyboard(' ');

    expect(screen.queryByText(/está sobre a coluna/)).not.toBeInTheDocument();
  });
});
