import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { servePlannerApi } from '@/test/planner-backend';
import { NOW, daily, entry, plannerWorld } from '@/test/planner-world';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { PHONE, findVeil, setViewport } from '@/test/viewport';
import { PlannerScreen } from './planner-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/semana');
  setViewport(PHONE);
});

afterEach(() => {
  navigateTo('/');
});

async function renderWeek() {
  const taskBackend = serveTaskApi(plannerWorld);
  servePlannerApi({ events: [daily], items: [entry()] }, taskBackend);
  renderWithQuery(<PlannerScreen now={NOW} />);
  await screen.findByRole('heading', { level: 1 });
  return userEvent.setup();
}

describe('the planner popovers on a phone', () => {
  it('opens the event as a modal sheet that the veil closes', async () => {
    const user = await renderWeek();
    await user.click(screen.getByRole('button', { name: 'Daily, 9:00 – 9:30' }));

    const dialog = await screen.findByRole('dialog', { name: 'Compromisso' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector('[data-sheet-handle]')).toBeInTheDocument();

    await user.click(findVeil());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens "Reservar tempo" as a sheet focused on the day, and cancels from the veil', async () => {
    const user = await renderWeek();
    await user.click(screen.getByRole('button', { name: /Ações da tarefa Lixar parede/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Reservar tempo…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reservar tempo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('combobox', { name: 'Dia' })).toHaveFocus();

    await user.click(findVeil());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
