import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { problemResponse } from '@/test/fixtures';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { serveTaskApi, type TaskBackend } from '@/test/task-backend';
import {
  card,
  demolicao,
  paint,
  piso,
  quote,
  reforma,
  sand,
  smash,
  world,
} from '@/test/task-world';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 12));
});

afterEach(() => {
  vi.useRealTimers();
  navigateTo('/');
});

type User = ReturnType<typeof userEvent.setup>;

async function openTask(
  target: { id: string; title: string },
  overrides: Partial<Parameters<typeof serveTaskApi>[0]> = {},
) {
  navigateTo(`/?iniciativa=${reforma.id}&tarefa=${target.id}`);
  const backend = serveTaskApi({ ...world, ...overrides });
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('complementary', { name: 'Tarefa' });
  return { backend, user: userEvent.setup() };
}

function panel() {
  return screen.getByRole('complementary', { name: 'Tarefa' });
}

function inPanel() {
  return within(panel());
}

function patches(backend: TaskBackend) {
  return backend.bodies;
}

async function chooseFrom(
  user: User,
  trigger: string,
  role: 'menuitem' | 'menuitemradio',
  item: string,
) {
  await user.click(inPanel().getByRole('button', { name: trigger }));
  await user.click(screen.getByRole(role, { name: item }));
}

function failPatches(code: string, status = 400) {
  server.use(http.patch('*/api/tasks/:id', () => problemResponse(code, status)));
}

describe('the title', () => {
  it('saves on Enter, updates the card and returns no error', async () => {
    const { backend, user } = await openTask(sand);

    const field = inPanel().getByRole('textbox', { name: 'Título da tarefa' });
    await user.clear(field);
    await user.type(field, 'Lixar o teto{Enter}');

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ title: 'Lixar o teto' }]);
    });
    expect(await screen.findByRole('article', { name: 'Lixar o teto' })).toBeVisible();
  });

  it('reverts on Esc without closing the panel', async () => {
    const { backend, user } = await openTask(sand);

    const field = inPanel().getByRole('textbox', { name: 'Título da tarefa' });
    await user.type(field, ' extra{Escape}');

    expect(field).toHaveValue('Lixar parede');
    expect(panel()).toBeVisible();
    expect(patches(backend)).toEqual([]);
  });

  it('refuses a blank title with a message and saves nothing', async () => {
    const { backend, user } = await openTask(sand);

    const field = inPanel().getByRole('textbox', { name: 'Título da tarefa' });
    await user.clear(field);
    await user.tab();

    expect(await inPanel().findByRole('alert')).toHaveTextContent('Dê um título à tarefa.');
    expect(field).toHaveValue('Lixar parede');
    expect(patches(backend)).toEqual([]);
  });

  it('ignores Enter while an input method is composing', async () => {
    const { backend } = await openTask(sand);
    const field = inPanel().getByRole('textbox', { name: 'Título da tarefa' });
    fireEvent.change(field, { target: { value: 'Lixar tudo' } });

    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });

    expect(field).toHaveValue('Lixar tudo');
    expect(patches(backend)).toEqual([]);
  });

  it('rolls the title back and shows the message from the server', async () => {
    const { user } = await openTask(sand);
    failPatches('task.title.too-long');

    const field = inPanel().getByRole('textbox', { name: 'Título da tarefa' });
    await user.type(field, ' longo{Enter}');

    expect(await inPanel().findByText('Use no máximo 300 caracteres.')).toBeVisible();
    await waitFor(() => {
      expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(
        'Lixar parede',
      );
    });
    expect(card('Lixar parede')).toBeVisible();
  });

  it('is edited from "Editar título" in the panel menu', async () => {
    const { user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Ações da tarefa' }));
    expect(screen.queryByRole('menuitem', { name: 'Abrir' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Editar título' }));

    expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveFocus();
  });
});

describe('closing', () => {
  it('closes with the × button', async () => {
    const { user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(window.location.search).not.toContain('tarefa');
  });

  it('closes with Esc from the panel itself', async () => {
    const { user } = await openTask(sand);
    panel().focus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('closes with Esc after a menu inside the panel was dismissed with Esc', async () => {
    const { user } = await openTask(sand);
    await user.click(inPanel().getByRole('button', { name: 'Estado: Em andamento' }));

    await user.keyboard('{Escape}');
    expect(panel()).toBeVisible();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });
});

describe('the state', () => {
  it('shows the state and moves the card when another one is chosen', async () => {
    const { backend, user } = await openTask(sand);
    expect(inPanel().getByRole('button', { name: 'Estado: Em andamento' })).toHaveTextContent(
      'Em andamento',
    );

    await chooseFrom(user, 'Estado: Em andamento', 'menuitemradio', 'Feito');

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ status: 'done' }]);
    });
    expect(inPanel().getByRole('button', { name: 'Estado: Feito' })).toBeVisible();
    const done = screen.getByRole('region', { name: 'Feito' });
    expect(within(done).getByRole('article', { name: 'Lixar parede' })).toBeVisible();
  });

  it('marks the current state as checked and saves nothing for the same one', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Estado: Em andamento' }));
    expect(screen.getByRole('menuitemradio', { name: 'Em andamento' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(screen.getByRole('menuitemradio', { name: 'Em andamento' }));

    expect(patches(backend)).toEqual([]);
  });

  it('rolls back with a message when it fails', async () => {
    const { backend, user } = await openTask(sand);
    backend.failing.add('PATCH');

    await chooseFrom(user, 'Estado: Em andamento', 'menuitemradio', 'Feito');

    expect(
      await inPanel().findByText('Não foi possível mover a tarefa. Tente de novo.'),
    ).toBeVisible();
    expect(inPanel().getByRole('button', { name: 'Estado: Em andamento' })).toBeVisible();
  });

  it('shows the "Bloqueada" selo next to the state and toggles it by the menu', async () => {
    const { backend, user } = await openTask(sand);
    expect(inPanel().queryByText('Bloqueada')).not.toBeInTheDocument();

    await chooseFrom(user, 'Estado: Em andamento', 'menuitem', 'Marcar como bloqueada');

    expect(await inPanel().findByText('Bloqueada')).toBeVisible();
    await chooseFrom(user, 'Estado: Em andamento', 'menuitem', 'Desbloquear');
    await waitFor(() => {
      expect(inPanel().queryByText('Bloqueada')).not.toBeInTheDocument();
    });
    expect(patches(backend)).toEqual([{ isBlocked: true }, { isBlocked: false }]);
  });

  it('shows the selo from the start for a blocked task and says when toggling fails', async () => {
    const { backend, user } = await openTask(quote);
    expect(inPanel().getByText('Bloqueada')).toBeVisible();
    backend.failing.add('PATCH');

    await chooseFrom(user, 'Estado: A fazer', 'menuitem', 'Desbloquear');

    expect(
      await inPanel().findByText('Não foi possível atualizar o bloqueio. Tente de novo.'),
    ).toBeVisible();
    expect(inPanel().getByText('Bloqueada')).toBeVisible();
  });

  it('toggles blocked from the "⋯" menu too', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Marcar como bloqueada' }));

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ isBlocked: true }]);
    });
  });
});

describe('the priority', () => {
  function radio(name: string) {
    return inPanel().getByRole('radio', { name });
  }

  it('shows the three priorities as a radiogroup with the current one checked', async () => {
    await openTask(sand);

    const group = inPanel().getByRole('radiogroup', { name: 'Prioridade' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((item) => item.textContent),
    ).toEqual(['P1', 'P2', 'P3']);
    expect(radio('P3')).toBeChecked();
    expect(radio('P3')).toHaveAttribute('tabindex', '0');
    expect(radio('P1')).toHaveAttribute('tabindex', '-1');
  });

  it('moves and selects with the arrow keys, wrapping around', async () => {
    const { backend, user } = await openTask(sand);
    radio('P3').focus();

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(radio('P2')).toBeChecked();
    });
    expect(radio('P2')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() => {
      expect(radio('P1')).toBeChecked();
    });
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(radio('P3')).toBeChecked();
    });
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(radio('P1')).toBeChecked();
    });
    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(radio('P2')).toBeChecked();
    });

    expect(patches(backend)).toEqual([
      { priority: 'P2' },
      { priority: 'P1' },
      { priority: 'P3' },
      { priority: 'P1' },
      { priority: 'P2' },
    ]);
  });

  it('ignores other keys and a click on the current priority', async () => {
    const { backend, user } = await openTask(sand);
    radio('P3').focus();

    await user.keyboard('a');
    await user.click(radio('P3'));

    expect(patches(backend)).toEqual([]);
  });

  it('selects with a click and rolls back with a message when it fails', async () => {
    const { backend, user } = await openTask(sand);
    backend.failing.add('PATCH');

    await user.click(radio('P1'));

    expect(
      await inPanel().findByText('Não foi possível mudar a prioridade. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(radio('P3')).toBeChecked();
    });
  });
});

describe('the phase', () => {
  it('lists the named phases and "Sem fase", with the current one checked', async () => {
    const { user } = await openTask(paint);

    await user.click(await inPanel().findByRole('button', { name: 'Fase: Fase 2 · Piso' }));

    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Sem fase',
      'Fase 1 · Demolição',
      'Fase 2 · Piso',
    ]);
    expect(screen.getByRole('menuitemradio', { name: 'Fase 2 · Piso' })).toBeChecked();
  });

  it('moves the task to another phase of the initiative', async () => {
    const { backend, user } = await openTask(paint);
    await inPanel().findByRole('button', { name: 'Fase: Fase 2 · Piso' });

    await chooseFrom(user, 'Fase: Fase 2 · Piso', 'menuitemradio', 'Fase 1 · Demolição');

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ phaseId: demolicao.id }]);
    });
    expect(inPanel().getByRole('button', { name: 'Fase: Fase 1 · Demolição' })).toBeVisible();
    expect(inPanel().getByRole('link', { name: 'Fase 1 · Demolição' })).toBeVisible();
  });

  it('sends null for "Sem fase" and drops the phase from the path', async () => {
    const { backend, user } = await openTask(paint);
    await inPanel().findByRole('button', { name: 'Fase: Fase 2 · Piso' });

    await chooseFrom(user, 'Fase: Fase 2 · Piso', 'menuitemradio', 'Sem fase');

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ phaseId: null }]);
    });
    expect(inPanel().getByRole('button', { name: 'Fase: Sem fase' })).toBeVisible();
    expect(inPanel().queryByRole('link', { name: /Fase \d/ })).not.toBeInTheDocument();
  });

  it('saves nothing for the phase it is already in', async () => {
    const { backend, user } = await openTask(paint);
    await inPanel().findByRole('button', { name: 'Fase: Fase 2 · Piso' });

    await chooseFrom(user, 'Fase: Fase 2 · Piso', 'menuitemradio', 'Fase 2 · Piso');

    expect(patches(backend)).toEqual([]);
  });

  it('rolls back with the message when the phase no longer exists', async () => {
    const { user } = await openTask(paint);
    await inPanel().findByRole('button', { name: 'Fase: Fase 2 · Piso' });
    failPatches('http.404', 404);

    await chooseFrom(user, 'Fase: Fase 2 · Piso', 'menuitemradio', 'Sem fase');

    expect(await inPanel().findByText('Essa fase não existe mais.')).toBeVisible();
    expect(inPanel().getByRole('button', { name: 'Fase: Fase 2 · Piso' })).toBeVisible();
  });

  it('starts at "Sem fase" for a task in the implicit phase', async () => {
    const { user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Fase: Sem fase' }));

    expect(screen.getByRole('menuitemradio', { name: 'Sem fase' })).toBeChecked();
  });

  it('says "Carregando" while the phases load', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&tarefa=${paint.id}`);
    serveTaskApi(world);
    server.use(
      http.get('*/api/initiatives/:id/phases', async () => {
        await new Promise(() => undefined);
      }),
    );
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('complementary', { name: 'Tarefa' });

    expect(await inPanel().findByRole('button', { name: 'Fase: Carregando' })).toHaveTextContent(
      'Carregando…',
    );
  });
});

describe('the deadline', () => {
  it('shows it as the card does, with the alert style for an overdue one', async () => {
    await openTask(paint);

    const button = inPanel().getByRole('button', { name: 'Prazo: venceu sex, 6 nov' });
    expect(button.className).toContain('overdue');
  });

  it('says "sem prazo" and saves a date picked on Enter', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Prazo: sem prazo' }));
    await user.type(inPanel().getByLabelText('Prazo'), '2026-11-20{Enter}');

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ deadline: '2026-11-20' }]);
    });
    expect(inPanel().getByRole('button', { name: 'Prazo: vence sex, 20 nov' })).toBeVisible();
    expect(within(card('Lixar parede')).getByText('vence sex, 20 nov')).toBeVisible();
  });

  it('keeps the old value and cancels with Esc', async () => {
    const { backend, user } = await openTask(paint);

    await user.click(inPanel().getByRole('button', { name: /^Prazo:/ }));
    await user.type(inPanel().getByLabelText('Prazo'), '2026-12-24{Escape}');

    expect(panel()).toBeVisible();
    expect(patches(backend)).toEqual([]);
    expect(inPanel().getByRole('button', { name: 'Prazo: venceu sex, 6 nov' })).toBeVisible();
  });

  it('clears it', async () => {
    const { backend, user } = await openTask(paint);

    await user.click(inPanel().getByRole('button', { name: 'Remover prazo' }));

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ deadline: null }]);
    });
    expect(inPanel().getByRole('button', { name: 'Prazo: sem prazo' })).toBeVisible();
  });

  it('rolls back with the message of an invalid date', async () => {
    const { user } = await openTask(sand);
    failPatches('task.deadline.invalid');

    await user.click(inPanel().getByRole('button', { name: 'Prazo: sem prazo' }));
    await user.type(inPanel().getByLabelText('Prazo'), '2026-11-20{Enter}');

    expect(await inPanel().findByText('Use uma data válida.')).toBeVisible();
    expect(inPanel().getByRole('button', { name: 'Prazo: sem prazo' })).toBeVisible();
  });
});

describe('the effort', () => {
  function field() {
    return inPanel().getByRole('textbox', { name: 'Esforço' });
  }

  it.each([
    ['6', 6, '6h'],
    ['1,5', 1.5, '1,5h'],
    ['1.5', 1.5, '1,5h'],
    ['2h', 2, '2h'],
  ])('reads %j and shows it as %s', async (typed, hours, shown) => {
    const { backend, user } = await openTask(sand);

    await user.type(field(), `${typed}{Enter}`);

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ estimatedEffort: hours }]);
    });
    expect(field()).toHaveValue(shown);
  });

  it('starts empty with a placeholder', async () => {
    await openTask(sand);

    expect(field()).toHaveValue('');
    expect(field()).toHaveAttribute('placeholder', 'Definir');
  });

  it('shows the saved effort and clears it when the field is emptied', async () => {
    const { backend, user } = await openTask(sand, {
      tasks: world.tasks.map((item) =>
        item.id === sand.id ? { ...item, estimatedEffort: 6 } : item,
      ),
    });
    expect(field()).toHaveValue('6h');

    await user.clear(field());
    await user.tab();

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ estimatedEffort: null }]);
    });
    expect(field()).toHaveValue('');
  });

  it('shows the message for an invalid text and keeps the old value', async () => {
    const { backend, user } = await openTask(sand, {
      tasks: world.tasks.map((item) =>
        item.id === sand.id ? { ...item, estimatedEffort: 6 } : item,
      ),
    });

    await user.clear(field());
    await user.type(field(), 'abc{Enter}');

    expect(
      await inPanel().findByText('Use de 0,01 a 999 horas, com até 2 casas decimais.'),
    ).toBeVisible();
    expect(field()).toHaveValue('6h');
    expect(patches(backend)).toEqual([]);
  });

  it.each(['0', '1000', '1,555', '-1'])('refuses %j', async (typed) => {
    const { backend, user } = await openTask(sand);

    await user.type(field(), `${typed}{Enter}`);

    expect(await inPanel().findByRole('alert')).toBeVisible();
    expect(field()).toHaveValue('');
    expect(patches(backend)).toEqual([]);
  });

  it('puts the formatted value back when the typed one means the same effort', async () => {
    const { backend, user } = await openTask(sand, {
      tasks: world.tasks.map((item) =>
        item.id === sand.id ? { ...item, estimatedEffort: 6 } : item,
      ),
    });

    await user.clear(field());
    await user.type(field(), '6{Enter}');

    await waitFor(() => {
      expect(field()).toHaveValue('6h');
    });
    expect(patches(backend)).toEqual([]);
  });

  it('reverts on Esc', async () => {
    const { backend, user } = await openTask(sand);

    await user.type(field(), '9{Escape}');

    expect(field()).toHaveValue('');
    expect(panel()).toBeVisible();
    expect(patches(backend)).toEqual([]);
  });

  it('rolls back with the message of the server', async () => {
    const { user } = await openTask(sand);
    failPatches('task.effort.invalid');

    await user.type(field(), '5{Enter}');

    expect(
      await inPanel().findByText('Use de 0,01 a 999 horas, com até 2 casas decimais.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(field()).toHaveValue('');
    });
  });

  it('ignores Enter while an input method is composing', async () => {
    const { backend } = await openTask(sand);
    fireEvent.change(field(), { target: { value: '5' } });

    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });

    expect(field()).toHaveValue('5');
    expect(patches(backend)).toEqual([]);
  });
});

describe('the week', () => {
  const planned = (week: string | null) => ({
    tasks: world.tasks.map((item) =>
      item.id === sand.id ? { ...item, plannedWeekStart: week } : item,
    ),
  });

  it('says "Não planejada" and has the steps disabled until a week is set', async () => {
    await openTask(sand);

    const group = inPanel().getByRole('group', { name: 'Semana' });
    expect(within(group).getByText('Não planejada')).toBeVisible();
    expect(within(group).getByRole('button', { name: 'Semana anterior' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
    expect(within(group).queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument();
  });

  it('plans the current ISO week with "Esta semana"', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(inPanel().getByRole('button', { name: 'Esta semana' }));

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ plannedWeekStart: '2026-11-16' }]);
    });
    expect(inPanel().getByText('Planejada na semana 47')).toBeVisible();
    expect(inPanel().getByText('16 a 22 nov')).toBeVisible();
  });

  it('steps a week forward and back', async () => {
    const { backend, user } = await openTask(sand, planned('2026-11-16'));

    await user.click(inPanel().getByRole('button', { name: 'Próxima semana' }));
    await waitFor(() => {
      expect(inPanel().getByText('Planejada na semana 48')).toBeVisible();
    });
    await user.click(inPanel().getByRole('button', { name: 'Semana anterior' }));
    await user.click(inPanel().getByRole('button', { name: 'Semana anterior' }));
    await waitFor(() => {
      expect(inPanel().getByText('Planejada na semana 46')).toBeVisible();
    });

    expect(patches(backend)).toEqual([
      { plannedWeekStart: '2026-11-23' },
      { plannedWeekStart: '2026-11-16' },
      { plannedWeekStart: '2026-11-09' },
    ]);
  });

  it('does nothing when "Esta semana" is already the planned one', async () => {
    const { backend, user } = await openTask(sand, planned('2026-11-16'));

    await user.click(inPanel().getByRole('button', { name: 'Esta semana' }));

    expect(patches(backend)).toEqual([]);
  });

  it('clears the week and moves focus to "Esta semana"', async () => {
    const { backend, user } = await openTask(sand, planned('2026-11-16'));

    await user.click(inPanel().getByRole('button', { name: 'Limpar' }));

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ plannedWeekStart: null }]);
    });
    expect(inPanel().getByText('Não planejada')).toBeVisible();
    expect(inPanel().getByRole('button', { name: 'Esta semana' })).toHaveFocus();
  });

  it('rolls back with a message when the week is refused', async () => {
    const { user } = await openTask(sand);
    failPatches('task.planned-week.invalid');

    await user.click(inPanel().getByRole('button', { name: 'Esta semana' }));

    expect(await inPanel().findByText('Escolha uma semana válida.')).toBeVisible();
    expect(inPanel().getByText('Não planejada')).toBeVisible();
  });

  it('disables the step at the edge of year 9999', async () => {
    await openTask(sand, planned('9999-12-27'));

    expect(inPanel().getByRole('button', { name: 'Próxima semana' })).toBeDisabled();
    expect(inPanel().getByRole('button', { name: 'Semana anterior' })).toBeEnabled();
  });
});

describe('the blockers', () => {
  const related = {
    tasks: world.tasks.map((item) => {
      if (item.id === smash.id) return { ...item, blocks: [quote.id] };
      if (item.id === quote.id) return { ...item, blockedBy: [smash.id] };
      return item;
    }),
  };

  function group(name: string) {
    return inPanel().getByRole('group', { name });
  }

  it('lists what the task blocks and what blocks it', async () => {
    await openTask(smash, related);
    expect(
      within(group('Bloqueia')).getByRole('button', { name: 'Pedir orçamento' }),
    ).toBeVisible();
    expect(
      within(group('Bloqueada por')).queryByRole('button', { name: 'Pedir orçamento' }),
    ).not.toBeInTheDocument();
  });

  it('lists the blockers of a blocked task', async () => {
    await openTask(quote, related);

    expect(
      within(group('Bloqueada por')).getByRole('button', { name: 'Quebrar piso' }),
    ).toBeVisible();
    expect(within(group('Bloqueia')).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('opens a listed task in the panel', async () => {
    const { user } = await openTask(smash, related);

    await user.click(within(group('Bloqueia')).getByRole('button', { name: 'Pedir orçamento' }));

    expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(
      'Pedir orçamento',
    );
    expect(window.location.search).toContain(`tarefa=${quote.id}`);
  });

  it('adds a task to "Bloqueia" from the combobox with the keyboard', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(within(group('Bloqueia')).getByRole('button', { name: '+ Adicionar' }));
    const input = within(group('Bloqueia')).getByRole('combobox', {
      name: 'Buscar tarefa para bloquear',
    });
    expect(input).toHaveFocus();
    await user.type(input, 'orcamento');
    expect(within(group('Bloqueia')).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(backend.calls).toContain(`block ${sand.id} ${quote.id}`);
    });
    expect(
      await within(group('Bloqueia')).findByRole('button', { name: 'Pedir orçamento' }),
    ).toBeVisible();
    expect(within(card('Lixar parede')).getByText('bloqueia 1')).toBeVisible();
    expect(within(card('Pedir orçamento')).getByText('esperando 1')).toBeVisible();
    expect(within(group('Bloqueia')).getByRole('button', { name: '+ Adicionar' })).toHaveFocus();
  });

  it('adds the blocker of the task from "Bloqueada por"', async () => {
    const { backend, user } = await openTask(sand);

    await user.click(within(group('Bloqueada por')).getByRole('button', { name: '+ Adicionar' }));
    await user.type(
      within(group('Bloqueada por')).getByRole('combobox', { name: 'Buscar tarefa bloqueadora' }),
      'tinta',
    );
    await user.click(within(group('Bloqueada por')).getByRole('option', { name: /Comprar tinta/ }));

    await waitFor(() => {
      expect(backend.calls).toContain(`block ${paint.id} ${sand.id}`);
    });
    expect(
      await within(group('Bloqueada por')).findByRole('button', { name: 'Comprar tinta' }),
    ).toBeVisible();
    expect(within(card('Comprar tinta')).getByText('bloqueia 1')).toBeVisible();
  });

  it('removes a blocker with its ×', async () => {
    const { backend, user } = await openTask(smash, related);

    await user.click(
      within(group('Bloqueia')).getByRole('button', { name: 'Remover Pedir orçamento' }),
    );

    await waitFor(() => {
      expect(backend.calls).toContain(`unblock ${smash.id} ${quote.id}`);
    });
    expect(
      within(group('Bloqueia')).queryByRole('button', { name: 'Pedir orçamento' }),
    ).not.toBeInTheDocument();
    expect(within(card('Quebrar piso')).queryByText(/bloqueia/)).not.toBeInTheDocument();
  });

  it('shows the message for a cycle and keeps the list as it was', async () => {
    const { backend, user } = await openTask(sand);
    backend.blockerProblem = 'task.blocker.cycle';

    await user.click(within(group('Bloqueia')).getByRole('button', { name: '+ Adicionar' }));
    await user.type(within(group('Bloqueia')).getByRole('combobox'), 'orcamento{Enter}');

    expect(
      await within(group('Bloqueia')).findByText(
        'Isso criaria um ciclo: a outra tarefa já depende desta.',
      ),
    ).toBeVisible();
    expect(
      within(group('Bloqueia')).queryByRole('button', { name: 'Pedir orçamento' }),
    ).not.toBeInTheDocument();
    expect(within(card('Lixar parede')).queryByText(/bloqueia/)).not.toBeInTheDocument();
  });

  it('says so when removing fails', async () => {
    const { backend, user } = await openTask(smash, related);
    backend.failing.add('DELETE-BLOCK');

    await user.click(
      within(group('Bloqueia')).getByRole('button', { name: 'Remover Pedir orçamento' }),
    );

    expect(
      await within(group('Bloqueia')).findByText(
        'Não foi possível remover o bloqueio. Tente de novo.',
      ),
    ).toBeVisible();
    expect(
      within(group('Bloqueia')).getByRole('button', { name: 'Pedir orçamento' }),
    ).toBeVisible();
  });
});

describe('the description', () => {
  function field() {
    return inPanel().getByRole('textbox', { name: 'Descrição' });
  }

  it('shows the saved text and saves on blur', async () => {
    const { backend, user } = await openTask(paint);
    expect(field()).toHaveValue('Duas latas de branco.');

    await user.type(field(), ' E um rolo.');
    expect(patches(backend)).toEqual([]);
    await user.tab();

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ description: 'Duas latas de branco. E um rolo.' }]);
    });
    expect(
      within(card('Comprar tinta')).getByText('Duas latas de branco. E um rolo.'),
    ).toBeVisible();
  });

  it('sends null for an emptied description', async () => {
    const { backend, user } = await openTask(paint);

    await user.clear(field());
    await user.tab();

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ description: null }]);
    });
  });

  it('shows the message of the server and keeps what was typed for another try', async () => {
    const { user } = await openTask(sand);
    failPatches('task.description.too-long');

    await user.type(field(), 'texto');
    await user.tab();

    expect(await inPanel().findByText('Use no máximo 10.000 caracteres.')).toBeVisible();
    expect(field()).toHaveValue('texto');
  });

  it('shows a generic message when saving fails', async () => {
    const { backend, user } = await openTask(sand);
    backend.failing.add('PATCH');

    await user.type(field(), 'texto');
    await user.tab();

    expect(
      await inPanel().findByText('Não foi possível salvar a descrição. Tente de novo.'),
    ).toBeVisible();
  });

  it('saves the description when the panel is closed with the × button', async () => {
    const { backend, user } = await openTask(sand);

    await user.type(field(), 'rascunho');
    await user.click(inPanel().getByRole('button', { name: 'Fechar' }));

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ description: 'rascunho' }]);
    });
  });

  it('does not leak the draft or the errors into the next task', async () => {
    const { backend, user } = await openTask(sand);
    backend.failing.add('PATCH');
    await user.type(inPanel().getByRole('textbox', { name: 'Título da tarefa' }), ' x{Enter}');
    expect(
      await inPanel().findByText('Não foi possível salvar o título. Tente de novo.'),
    ).toBeVisible();

    await user.click(card('Quebrar piso'));

    expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(
      'Quebrar piso',
    );
    expect(inPanel().queryByRole('alert')).not.toBeInTheDocument();
    expect(field()).toHaveValue('');
  });
});

describe('the footer', () => {
  it('shows the creation date and a relative time of the last change', async () => {
    const recent = world.tasks.map((item) =>
      item.id === sand.id ? { ...item, updatedAt: '2026-11-18T10:00:00-03:00' } : item,
    );
    await openTask(sand, { tasks: recent });

    expect(
      inPanel().getByText('Criada em 1 jan · alterada há 2 h · salva automaticamente'),
    ).toBeVisible();
  });

  it('shows the date for an old change', async () => {
    await openTask(sand);

    expect(
      inPanel().getByText('Criada em 1 jan · alterada em 1 jan · salva automaticamente'),
    ).toBeVisible();
  });

  it('refreshes the relative time each minute', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 30));
    const recent = world.tasks.map((item) =>
      item.id === sand.id ? { ...item, updatedAt: '2026-11-18T12:00:00-03:00' } : item,
    );
    await openTask(sand, { tasks: recent });
    expect(inPanel().getByText(/alterada agora/)).toBeVisible();

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 18, 12, 4, 30));
      vi.advanceTimersByTime(60_000);
    });

    expect(inPanel().getByText(/alterada há 5 min/)).toBeVisible();
  });
});

describe('the panel header', () => {
  it('shows the initiative and, for a named phase, its link', async () => {
    await openTask(paint);

    expect(await inPanel().findByRole('link', { name: 'Fase 2 · Piso' })).toHaveAttribute(
      'href',
      `?iniciativa=${reforma.id}&fase=${piso.id}`,
    );
    expect(inPanel().getByRole('link', { name: 'Reforma' })).toBeVisible();
  });
});

describe('focus inside the panel', () => {
  const related = {
    tasks: world.tasks.map((item) => {
      if (item.id === smash.id) return { ...item, blocks: [quote.id, sand.id] };
      if (item.id === quote.id) return { ...item, blockedBy: [smash.id] };
      if (item.id === sand.id) return { ...item, blockedBy: [smash.id] };
      return item;
    }),
  };

  it('moves into the panel when a listed task is opened, so Esc still closes it', async () => {
    const { user } = await openTask(smash, related);

    await user.click(
      within(inPanel().getByRole('group', { name: 'Bloqueia' })).getByRole('button', {
        name: 'Pedir orçamento',
      }),
    );

    await waitFor(() => {
      expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(
        'Pedir orçamento',
      );
    });
    expect(panel().contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('moves to the next × after a removal, then to "+ Adicionar" when the list is empty', async () => {
    const { user } = await openTask(smash, related);
    const blocks = inPanel().getByRole('group', { name: 'Bloqueia' });

    await user.click(within(blocks).getByRole('button', { name: 'Remover Lixar parede' }));
    await waitFor(() => {
      expect(within(blocks).queryByRole('button', { name: 'Lixar parede' })).toBeNull();
    });
    expect(within(blocks).getByRole('button', { name: 'Remover Pedir orçamento' })).toHaveFocus();

    await user.click(within(blocks).getByRole('button', { name: 'Remover Pedir orçamento' }));
    await waitFor(() => {
      expect(within(blocks).queryByRole('button', { name: 'Pedir orçamento' })).toBeNull();
    });
    expect(within(blocks).getByRole('button', { name: '+ Adicionar' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('removes two blockers clicked one right after the other', async () => {
    const { backend, user } = await openTask(smash, related);
    const blocks = inPanel().getByRole('group', { name: 'Bloqueia' });

    await user.click(within(blocks).getByRole('button', { name: 'Remover Lixar parede' }));
    await user.click(within(blocks).getByRole('button', { name: 'Remover Pedir orçamento' }));

    await waitFor(() => {
      expect(backend.calls).toEqual(
        expect.arrayContaining([
          `unblock ${smash.id} ${sand.id}`,
          `unblock ${smash.id} ${quote.id}`,
        ]),
      );
    });
  });

  it('moves into the panel when Enter opens another card, and Esc returns to that card', async () => {
    const { user } = await openTask(smash);
    await waitFor(() => {
      expect(panel()).toHaveFocus();
    });
    card('Lixar parede').focus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(inPanel().getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(
        'Lixar parede',
      );
    });
    expect(panel().contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(card('Lixar parede')).toHaveFocus();
  });

  it('does not push a second history entry for Enter on the open card', async () => {
    const { user } = await openTask(smash);
    const before = window.history.length;
    card('Quebrar piso').focus();

    await user.keyboard('{Enter}');

    expect(window.history.length).toBe(before);
    await waitFor(() => {
      expect(panel()).toHaveFocus();
    });
  });

  it('saves a description waiting when the panel closes without a blur', async () => {
    const { backend } = await openTask(sand);
    fireEvent.change(inPanel().getByRole('textbox', { name: 'Descrição' }), {
      target: { value: 'sem blur' },
    });

    fireEvent.keyDown(panel(), { key: 'Escape' });

    await waitFor(() => {
      expect(patches(backend)).toEqual([{ description: 'sem blur' }]);
    });
  });
});

describe('a keyboard drag', () => {
  it('is not interrupted by Enter or E on the card', async () => {
    navigateTo(`/?iniciativa=${reforma.id}`);
    serveTaskApi(world);
    renderWithQuery(<InitiativesScreen />);
    const user = userEvent.setup();
    await screen.findByRole('article', { name: 'Lixar parede' });
    card('Lixar parede').focus();
    await user.keyboard(' ');
    await screen.findByText(/A tarefa Lixar parede está sobre a coluna/);

    await user.keyboard('{Enter}');
    await user.keyboard('e');

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(within(card('Lixar parede')).queryByRole('textbox')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
  });
});
