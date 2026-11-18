import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { horta, piso, reforma, world } from '@/test/task-world';
import { TABLET, findVeil, setViewport } from '@/test/viewport';
import { InitiativesScreen } from './initiatives-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 5, 10));
  navigateTo('/');
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  navigateTo('/');
});

async function renderTablet(url = '/') {
  setViewport(TABLET);
  serveTaskApi(world);
  navigateTo(url);
  renderWithQuery(<InitiativesScreen />);
  return screen.findByRole('button', { name: 'Iniciativas' });
}

describe('initiative index as a drawer', () => {
  it('stays in place on a desktop, with no button', async () => {
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('navigation', { name: 'Iniciativas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciativas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is closed on a tablet, with a button at the top of the board', async () => {
    const opener = await renderTablet();

    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Iniciativas' })).not.toBeInTheDocument();
  });

  it('opens from the button as a modal with the index inside', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();

    await user.click(opener);

    const drawer = screen.getByRole('dialog', { name: 'Gaveta de iniciativas' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getByRole('navigation', { name: 'Iniciativas' })).toBeInTheDocument();
  });

  it('closes when an initiative is chosen, and returns focus to the button', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();
    await user.click(opener);

    await user.click(screen.getByRole('button', { name: /^Horta/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(window.location.search).toContain(horta.id);
    expect(await screen.findByRole('heading', { level: 1, name: 'Horta' })).toBeInTheDocument();
  });

  it('closes when a phase is chosen', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet(`/?iniciativa=${reforma.id}`);
    await user.click(opener);

    await user.click(await screen.findByRole('button', { name: /^Fase 2 · Piso/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toContain(piso.id);
    });
  });

  it('closes on Escape and on a tap on the veil', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();
    await user.click(opener);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    await user.click(findVeil());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the details of an initiative open from its menu', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();
    await user.click(opener);

    await user.click(screen.getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Abrir detalhes' }));

    expect(screen.queryByRole('dialog', { name: 'Gaveta de iniciativas' })).not.toBeInTheDocument();
    expect(await screen.findByRole('complementary', { name: 'Iniciativa' })).toBeInTheDocument();
  });

  it('starts closed again after the screen went back to the desktop width', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();
    await user.click(opener);

    setViewport({ width: 1440, coarse: false });
    expect(await screen.findByRole('navigation', { name: 'Iniciativas' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    setViewport(TABLET);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts focus on the selected row when the drawer closes because the screen widened', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet(`/?iniciativa=${horta.id}`);
    await user.click(opener);

    setViewport({ width: 1440, coarse: false });

    const index = await screen.findByRole('navigation', { name: 'Iniciativas' });
    const row = within(index).getByRole('button', { name: /^Horta/ });
    await waitFor(() => {
      expect(row).toHaveFocus();
    });
  });

  it('puts focus on "Todas as tarefas" when nothing was selected', async () => {
    const user = userEvent.setup();
    const opener = await renderTablet();
    await user.click(opener);

    setViewport({ width: 1440, coarse: false });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Todas as tarefas' })).toHaveFocus();
    });
  });
});

describe('first use on a narrow screen', () => {
  it('offers "+ Nova iniciativa" on the board, which opens the drawer on the create field', async () => {
    setViewport(TABLET);
    serveTaskApi({ initiatives: [] });
    const user = userEvent.setup();
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByText('Nenhuma iniciativa ainda.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Nova iniciativa' }));

    const drawer = screen.getByRole('dialog', { name: 'Gaveta de iniciativas' });
    expect(within(drawer).getByRole('textbox', { name: 'Nome da nova iniciativa' })).toHaveFocus();
  });

  it('does not reopen the create field when the drawer is opened again from "Iniciativas"', async () => {
    setViewport(TABLET);
    serveTaskApi({ initiatives: [] });
    const user = userEvent.setup();
    renderWithQuery(<InitiativesScreen />);
    await screen.findByText('Nenhuma iniciativa ainda.');
    await user.click(screen.getByRole('button', { name: '+ Nova iniciativa' }));
    await user.click(findVeil());

    await user.click(screen.getByRole('button', { name: 'Iniciativas' }));

    const drawer = screen.getByRole('dialog', { name: 'Gaveta de iniciativas' });
    expect(
      within(drawer).queryByRole('textbox', { name: 'Nome da nova iniciativa' }),
    ).not.toBeInTheDocument();
    expect(drawer).toHaveFocus();
  });

  it('does not show it once an initiative exists, or on a desktop', async () => {
    await renderTablet();
    expect(screen.queryByText('Nenhuma iniciativa ainda.')).not.toBeInTheDocument();

    setViewport({ width: 1440, coarse: false });
    expect(screen.queryByRole('button', { name: '+ Nova iniciativa' })).toBeInTheDocument();
  });
});
