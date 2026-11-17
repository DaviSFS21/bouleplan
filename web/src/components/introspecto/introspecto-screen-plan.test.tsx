import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sheet } from '@/test/introspection-backend';
import {
  NEXT,
  TUESDAY,
  WEEK,
  box,
  planting,
  renderSheet,
  reviewPlan,
  sanding,
  section,
  tap,
} from '@/test/introspecto-world';
import { navigateTo } from '@/test/next-navigation';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo('/introspecto');
});

afterEach(() => {
  navigateTo('/');
});

function plan() {
  return within(section('A próxima semana'));
}

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected the element to exist.');
  return value;
}

function total() {
  return present(plan().getByText('Na semana').parentElement);
}

describe('the planning of the next week', () => {
  it('puts what was left behind first, then the open tasks by initiative, each task once', async () => {
    await renderSheet();

    const tray = plan().getByRole('list', { name: 'Ficaram para trás' });
    expect(within(tray).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(tray).getByRole('checkbox', { name: 'Lixar parede' })).toBeVisible();
    expect(within(tray).getByRole('checkbox', { name: 'Quebrar piso' })).toBeVisible();
    const headings = plan()
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Ficaram para trás', 'A fazer, por iniciativa']);
    const groups = plan().getAllByRole('button', { expanded: true });
    expect(groups.map((group) => group.textContent)).toEqual([
      'Reforma1 de 2 marcadas',
      'Horta2 a fazer',
    ]);
    expect(plan().getAllByText('Lixar parede')).toHaveLength(1);
    expect(plan().getAllByText('Quebrar piso')).toHaveLength(1);
  });

  it('does not list done tasks or tasks of a task already in the tray inside a group', async () => {
    await renderSheet();

    expect(plan().queryByText('Pintar sala')).not.toBeInTheDocument();
    expect(plan().queryByText('Comprar sementes')).not.toBeInTheDocument();
    expect(plan().getByRole('checkbox', { name: 'Regar canteiro' })).toBeVisible();
  });

  it('shows a task as checked only when it is already planned for the next week', async () => {
    await renderSheet();

    expect(box('Revisar o projeto')).toBeChecked();
    expect(box('Lixar parede')).not.toBeChecked();
    expect(box('Instalar torneira')).not.toBeChecked();
    expect(box('Plantar alface')).not.toBeChecked();
  });

  it('shows the priority, the deadline and the effort on each row', async () => {
    await renderSheet();

    const row = box('Lixar parede');
    expect(row).toHaveTextContent('P1');
    expect(row).toHaveAccessibleDescription(/P1/);
    expect(row).toHaveAccessibleDescription(/venceu sáb, 14 nov/);
    expect(row).toHaveTextContent('4h');
    expect(box('Quebrar piso')).toHaveTextContent('sem estimativa');
    expect(box('Plantar alface')).toHaveTextContent('1,5h');
    expect(box('Instalar torneira')).toHaveAccessibleDescription(/sem prazo/);
  });

  it('counts what is marked per group and in the tray', async () => {
    await renderSheet();

    expect(plan().getByRole('button', { name: /^Reforma/ })).toHaveTextContent('1 de 2 marcadas');
    expect(plan().getByRole('button', { name: /^Horta/ })).toHaveTextContent('2 a fazer');
    expect(plan().getByText('0 de 2 entram')).toBeVisible();
  });
});

describe('checking a task', () => {
  it('sets the next week at once, then confirms it', async () => {
    const { tasks, user } = await renderSheet();

    await user.click(box('Instalar torneira'));

    expect(box('Instalar torneira')).toBeChecked();
    await waitFor(() => {
      expect(tasks.tasks.find(({ id }) => id === tap.id)?.plannedWeekStart).toBe(NEXT);
    });
    expect(tasks.bodies.at(-1)).toEqual({ plannedWeekStart: NEXT });
    expect(plan().getByRole('button', { name: /^Reforma/ })).toHaveTextContent('2 de 2 marcadas');
  });

  it('moves a task left behind to the next week and counts it in the tray', async () => {
    const { tasks, user } = await renderSheet();

    await user.click(box('Lixar parede'));

    expect(box('Lixar parede')).toBeChecked();
    expect(plan().getByText('1 de 2 entram')).toBeVisible();
    await waitFor(() => {
      expect(tasks.tasks.find(({ id }) => id === sanding.id)?.plannedWeekStart).toBe(NEXT);
    });
    // It stays on the summary of the reviewed week and in the tray.
    expect(box('Lixar parede')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ficaram para trás · 2' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Concluídas · 2' })).toBeVisible();
  });

  it('toggles from a click anywhere on the row', async () => {
    const { user } = await renderSheet();

    await user.click(within(box('Plantar alface')).getByText('Plantar alface'));
    expect(box('Plantar alface')).toBeChecked();

    await user.click(within(box('Plantar alface')).getByText('1,5h'));
    expect(box('Plantar alface')).not.toBeChecked();
  });

  it('toggles with the Space key', async () => {
    const { user } = await renderSheet();

    box('Regar canteiro').focus();
    await user.keyboard(' ');
    expect(box('Regar canteiro')).toBeChecked();

    await user.keyboard(' ');
    expect(box('Regar canteiro')).not.toBeChecked();
  });

  it('unchecks by clearing the planned week', async () => {
    const { tasks, user } = await renderSheet();

    await user.click(box('Revisar o projeto'));

    expect(box('Revisar o projeto')).not.toBeChecked();
    await waitFor(() => {
      expect(tasks.tasks.find(({ id }) => id === reviewPlan.id)?.plannedWeekStart).toBeNull();
    });
    expect(tasks.bodies.at(-1)).toEqual({ plannedWeekStart: null });
  });

  it('rolls the mark back and warns when the save fails', async () => {
    const { tasks, user } = await renderSheet();
    tasks.failing.add('PATCH');

    await user.click(box('Instalar torneira'));

    await waitFor(() => {
      expect(box('Instalar torneira')).not.toBeChecked();
    });
    expect(
      await within(screen.getByRole('status', { name: 'Avisos' })).findByText(
        'Não foi possível salvar a semana. Tente de novo.',
      ),
    ).toBeVisible();
    expect(plan().getByRole('button', { name: /^Reforma/ })).toHaveTextContent('1 de 2 marcadas');
    expect(tasks.tasks.find(({ id }) => id === tap.id)?.plannedWeekStart).toBeNull();
  });

  it('rolls an uncheck back to the next week when the save fails', async () => {
    const { tasks, user } = await renderSheet();
    tasks.failing.add('PATCH');

    await user.click(box('Revisar o projeto'));

    await waitFor(() => {
      expect(box('Revisar o projeto')).toBeChecked();
    });
  });

  it('plans for the Monday after the reviewed week', async () => {
    const { tasks, user } = await renderSheet({ now: TUESDAY });

    await user.click(box('Instalar torneira'));

    await waitFor(() => {
      expect(tasks.bodies.at(-1)).toEqual({ plannedWeekStart: WEEK });
    });
  });
});

describe('the total of the week', () => {
  it('counts what is marked with its effort, and what has no estimate apart', async () => {
    const { user } = await renderSheet();

    expect(total()).toHaveTextContent('1 tarefa · 3h');
    expect(total()).not.toHaveTextContent('sem estimativa');

    await user.click(box('Plantar alface'));
    expect(total()).toHaveTextContent('2 tarefas · 4,5h');

    await user.click(box('Regar canteiro'));
    expect(total()).toHaveTextContent('3 tarefas · 4,5h · 1 sem estimativa');

    await user.click(box('Instalar torneira'));
    await user.click(box('Lixar parede'));
    expect(total()).toHaveTextContent('5 tarefas · 10,5h · 1 sem estimativa');
  });

  it('says nothing is marked when nothing is, and is announced politely', async () => {
    const { user } = await renderSheet();

    await user.click(box('Revisar o projeto'));

    expect(total()).toHaveTextContent('Nada marcado ainda');
    expect(total()).toHaveAttribute('aria-live', 'polite');
  });

  it('counts a marked task without an estimate even when it is the only one', async () => {
    const { user } = await renderSheet();
    await user.click(box('Revisar o projeto'));

    await user.click(box('Quebrar piso'));

    expect(total()).toHaveTextContent('1 tarefa · 0h · 1 sem estimativa');
  });
});

describe('the groups', () => {
  it('collapse and expand, keeping their counter and the marks', async () => {
    const { user } = await renderSheet();
    const group = plan().getByRole('button', { name: /^Reforma/ });
    const list = present(document.getElementById(group.getAttribute('aria-controls') ?? ''));

    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(list).toBeVisible();

    await user.click(group);

    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toBeVisible();
    expect(plan().queryByRole('checkbox', { name: 'Revisar o projeto' })).not.toBeInTheDocument();
    expect(group).toHaveTextContent('1 de 2 marcadas');
    expect(total()).toHaveTextContent('1 tarefa · 3h');

    await user.click(group);

    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(box('Revisar o projeto')).toBeChecked();
  });

  it('always keeps the tray of what was left behind open', async () => {
    await renderSheet();

    const tray = plan().getByRole('list', { name: 'Ficaram para trás' });
    expect(tray).toBeVisible();
    expect(
      within(present(plan().getByText('Ficaram para trás').parentElement)).queryByRole('button'),
    ).toBeNull();
  });

  it('leaves out an initiative with nothing to do', async () => {
    await renderSheet({
      world: { tasks: [{ ...tap, status: 'done', plannedWeekStart: null }, planting] },
    });

    expect(plan().queryByRole('button', { name: /^Reforma/ })).not.toBeInTheDocument();
    expect(plan().getByRole('button', { name: /^Horta/ })).toBeVisible();
  });

  it('says so when nothing was left behind and nothing is open', async () => {
    await renderSheet({ world: { tasks: [] } });

    expect(plan().getByText('nada ficou')).toBeVisible();
    expect(plan().getByText('Nenhuma tarefa a fazer.')).toBeVisible();
    expect(total()).toHaveTextContent('Nada marcado ainda');
  });
});

describe('a closed sheet', () => {
  it('shows the marks but cannot change them', async () => {
    const { tasks, user } = await renderSheet({
      sheets: [sheet(WEEK, { closedAt: '2026-11-21T08:00:00-03:00' })],
    });

    expect(box('Revisar o projeto')).toBeChecked();
    expect(box('Revisar o projeto')).toBeDisabled();
    expect(box('Instalar torneira')).toBeDisabled();
    expect(box('Lixar parede')).toBeDisabled();
    await user.click(box('Instalar torneira'));

    expect(box('Instalar torneira')).not.toBeChecked();
    expect(tasks.bodies).toHaveLength(0);
    expect(total()).toHaveTextContent('1 tarefa · 3h');
  });
});
