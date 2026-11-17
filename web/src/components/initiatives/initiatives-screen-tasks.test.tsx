import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { card, piso, reforma, titles, world } from '@/test/task-world';
import { InitiativesScreen } from './initiatives-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/');
});

afterEach(() => {
  navigateTo('/');
});

function index() {
  return screen.getByRole('navigation', { name: 'Iniciativas' });
}

describe('progress in the index', () => {
  it('shows done of total for each initiative and a bar with the count', async () => {
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });
    expect(await within(index()).findByText('0 de 4 feitas')).toBeVisible();
    expect(within(index()).getByText('1 de 1 feitas')).toBeVisible();
    expect(
      within(index()).getByRole('progressbar', { name: 'Progresso de Reforma' }),
    ).toHaveAttribute('aria-valuemax', '4');
  });

  it('shows "sem tarefas ainda" for an initiative without tasks', async () => {
    serveTaskApi({
      ...world,
      tasks: world.tasks.filter(({ initiativeId }) => initiativeId === reforma.id),
    });
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });
    expect(await within(index()).findByText('sem tarefas ainda')).toBeVisible();
  });

  it('shows no progress while the tasks load', async () => {
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('navigation', { name: 'Iniciativas' });

    expect(within(index()).queryByText('sem tarefas ainda')).not.toBeInTheDocument();
    await within(index()).findByText('0 de 4 feitas');
  });

  it('counts done tasks per phase next to the phase', async () => {
    const backend = serveTaskApi(world);
    backend.tasks[0] = { ...backend.tasks[0], status: 'done' } as (typeof backend.tasks)[number];
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });
    const phaseButton = await within(index()).findByRole('button', { name: 'Fase 2 · Piso' });

    await waitFor(() => {
      expect(phaseButton).toHaveAccessibleDescription('1/1');
    });
    expect(
      within(index()).getByRole('button', { name: 'Fase 1 · Demolição' }),
    ).toHaveAccessibleDescription('0/1');
  });
});

describe('hiding tasks with their phase or initiative', () => {
  it('drops the tasks of an archived phase and brings them back on undo', async () => {
    const user = userEvent.setup();
    serveTaskApi(world);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('article', { name: 'Comprar tinta' });
    await within(index()).findByRole('button', { name: 'Fase 2 · Piso' });

    await user.click(within(index()).getByRole('button', { name: `Ações da fase ${piso.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Comprar tinta' })).not.toBeInTheDocument();
    });
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('article', { name: 'Comprar tinta' })).toBeVisible();
  });

  it('drops the tasks of an archived initiative from "Todas as tarefas" and restores them', async () => {
    const user = userEvent.setup();
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('article', { name: 'Plantar alface' });

    await user.click(screen.getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Plantar alface' })).not.toBeInTheDocument();
    });
    expect(titles('Em andamento')).toEqual(['Lixar parede']);
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('article', { name: 'Plantar alface' })).toBeVisible();
    expect(card('Plantar alface')).toBeVisible();
  });
});
