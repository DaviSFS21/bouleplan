import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { serveTaskApi } from '@/test/task-backend';
import { card, column, horta, piso, reforma, titles, world } from '@/test/task-world';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';

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

async function renderBoard(url = '/') {
  const backend = serveTaskApi(world);
  navigateTo(url);
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('article', { name: 'Comprar tinta' });
  return backend;
}

function hasAlert(element: HTMLElement) {
  return element.className.includes('alert');
}

describe('columns and filters', () => {
  it('always shows the three states with the count of visible cards', async () => {
    await renderBoard();

    expect(screen.getByRole('heading', { level: 2, name: 'A fazer · 3' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Em andamento · 1' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Feito · 1' })).toBeVisible();
  });

  it('sorts a column by priority, deadline (none last) and creation', async () => {
    await renderBoard();

    expect(titles('A fazer')).toEqual(['Comprar tinta', 'Quebrar piso', 'Pedir orçamento']);
  });

  it('shows the empty states of an initiative without tasks', async () => {
    serveTaskApi({ initiatives: [reforma] });
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 2, name: 'A fazer · 0' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Feito · 0' })).toBeVisible();
  });

  it('filters by initiative, including every phase and the implicit one', async () => {
    const user = userEvent.setup();
    await renderBoard();

    await user.click(
      within(screen.getByRole('navigation', { name: 'Iniciativas' })).getByRole('button', {
        name: /^Horta/,
      }),
    );

    expect(titles('Feito')).toEqual(['Plantar alface']);
    expect(titles('A fazer')).toEqual([]);
    expect(screen.getByRole('heading', { level: 2, name: 'Feito · 1' })).toBeVisible();
  });

  it('shows all the tasks of one initiative with its implicit-phase ones', async () => {
    await renderBoard(`/?iniciativa=${reforma.id}`);

    expect(titles('A fazer')).toEqual(['Comprar tinta', 'Quebrar piso', 'Pedir orçamento']);
    expect(titles('Em andamento')).toEqual(['Lixar parede']);
    expect(titles('Feito')).toEqual([]);
  });

  it('filters by one phase and goes back to the initiative on a second click', async () => {
    const user = userEvent.setup();
    await renderBoard(`/?iniciativa=${reforma.id}`);
    const phaseButton = await screen.findByRole('button', { name: 'Fase 2 · Piso' });

    await user.click(phaseButton);

    expect(titles('A fazer')).toEqual(['Comprar tinta']);
    expect(titles('Em andamento')).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Fase 2 · Piso' }));

    expect(titles('Em andamento')).toEqual(['Lixar parede']);
  });

  it('says it could not load the tasks and retries', async () => {
    const user = userEvent.setup();
    serveTaskApi(world);
    let fail = true;
    server.use(
      http.get('*/api/tasks', () =>
        fail ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(world.tasks),
      ),
    );
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByText('Não foi possível carregar as tarefas.')).toBeVisible();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('article', { name: 'Comprar tinta' })).toBeVisible();
  });
});

describe('card anatomy', () => {
  it('shows priority, title, description, path and deadline', async () => {
    await renderBoard();
    await within(card('Comprar tinta')).findByText('Reforma › Fase 2 · Piso');
    const paintCard = within(card('Comprar tinta'));

    expect(paintCard.getByText('P1')).toBeVisible();
    expect(paintCard.getByText('Comprar tinta')).toBeVisible();
    expect(paintCard.getByText('Duas latas de branco.')).toBeVisible();
    expect(paintCard.getByText('vence amanhã')).toBeVisible();
  });

  it('shows only the initiative for a task in the implicit phase', async () => {
    await renderBoard();

    expect(within(card('Lixar parede')).getByText('Reforma')).toBeVisible();
    expect(within(card('Lixar parede')).getByText('sem prazo')).toBeVisible();
  });

  it('hides the path when an initiative or a phase is selected', async () => {
    await renderBoard(`/?iniciativa=${reforma.id}&fase=${piso.id}`);

    expect(within(card('Comprar tinta')).queryByText(/Reforma/)).not.toBeInTheDocument();
  });

  it('marks a blocked task with the Bloqueada selo', async () => {
    await renderBoard();

    expect(within(card('Pedir orçamento')).getByText('Bloqueada')).toBeVisible();
    expect(within(card('Lixar parede')).queryByText('Bloqueada')).not.toBeInTheDocument();
  });

  it('puts the attention color on a deadline due tomorrow, but never on a done task', async () => {
    await renderBoard();

    expect(hasAlert(within(card('Comprar tinta')).getByText('vence amanhã'))).toBe(true);
    const overdue = within(card('Plantar alface')).getByText('venceu ontem');
    expect(hasAlert(overdue)).toBe(false);
    expect(hasAlert(within(card('Quebrar piso')).getByText(/^vence/))).toBe(false);
  });

  it('words the deadline in Portuguese with the local date', async () => {
    await renderBoard();

    expect(within(card('Quebrar piso')).getByText('vence ter, 10 nov')).toBeVisible();
  });

  it('threads the initiative color on the left of the card', async () => {
    await renderBoard();

    expect(card('Comprar tinta').style.getPropertyValue('--ini')).toBe('var(--ini-turquesa)');
    expect(card('Plantar alface').style.getPropertyValue('--ini')).toBe('var(--ini-verde)');
  });

  it('is focusable from the keyboard', async () => {
    await renderBoard();

    expect(card('Comprar tinta')).toHaveAttribute('tabindex', '0');
  });
});

describe('quick create', () => {
  it('creates in the column state and initiative filter, stays open and clears', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}`);

    await user.click(within(column('Em andamento')).getByRole('button', { name: '+ Nova tarefa' }));
    const field = within(column('Em andamento')).getByRole('textbox', {
      name: 'Título da nova tarefa',
    });
    await user.type(field, '  Pintar teto {Enter}');

    expect(
      await within(column('Em andamento')).findByRole('article', { name: 'Pintar teto' }),
    ).toBeVisible();
    expect(backend.bodies).toEqual([{ title: 'Pintar teto', status: 'in_progress' }]);
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.getByRole('heading', { level: 2, name: 'Em andamento · 2' })).toBeVisible();
  });

  it('creates in the filtered phase', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}&fase=${piso.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Piso' });

    await user.click(within(column('Feito')).getByRole('button', { name: '+ Nova tarefa' }));
    await user.type(
      within(column('Feito')).getByRole('textbox', { name: 'Título da nova tarefa' }),
      'Rejuntar{Enter}',
    );

    await within(column('Feito')).findByRole('article', { name: 'Rejuntar' });
    expect(backend.bodies).toEqual([{ title: 'Rejuntar', status: 'done', phaseId: piso.id }]);
  });

  it('cancels with Esc without reaching the page and closes when blurred empty', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    document.addEventListener('keydown', onKeyDown);
    await renderBoard(`/?iniciativa=${reforma.id}`);
    const add = () => within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' });

    await user.click(add());
    onKeyDown.mockClear();
    await user.keyboard('{Escape}');

    expect(onKeyDown).not.toHaveBeenCalled();
    expect(add()).toHaveFocus();
    document.removeEventListener('keydown', onKeyDown);

    await user.click(add());
    await user.click(screen.getByRole('heading', { level: 1, name: /Reforma/ }));
    expect(add()).toBeVisible();
  });

  it('ignores Enter while composing and blocks a blank title with a message', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}`);
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));
    const field = within(column('A fazer')).getByRole('textbox', { name: 'Título da nova tarefa' });

    await user.type(field, 'x');
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }),
    );
    expect(backend.bodies).toEqual([]);

    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Dê um título à tarefa.')).toBeVisible();
  });

  it('shows the pt-BR message when the API rejects the title', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}`);
    backend.failing.add('POST');
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));

    await user.type(
      within(column('A fazer')).getByRole('textbox', { name: 'Título da nova tarefa' }),
      'Falha{Enter}',
    );

    expect(
      await screen.findByText('Não foi possível criar a tarefa. Tente de novo.'),
    ).toBeVisible();
  });

  it('chooses the initiative in "Todas as tarefas" and remembers it across reloads', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard();
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));
    const chooser = within(column('A fazer')).getByRole('combobox', {
      name: 'Iniciativa da nova tarefa',
    });
    expect(chooser).toHaveValue(reforma.id);

    await user.selectOptions(chooser, horta.id);
    await user.type(
      within(column('A fazer')).getByRole('textbox', { name: 'Título da nova tarefa' }),
      'Regar{Enter}',
    );

    await within(column('A fazer')).findByRole('article', { name: 'Regar' });
    expect(backend.bodies).toEqual([{ title: 'Regar', status: 'to_do' }]);
    expect(window.localStorage.getItem('bouleplan.quick-task-initiative')).toBe(horta.id);
    expect(within(card('Regar')).getByText('Horta')).toBeVisible();
  });

  it('starts from the remembered initiative after a reload', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('bouleplan.quick-task-initiative', horta.id);
    await renderBoard();
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));

    expect(
      within(column('A fazer')).getByRole('combobox', { name: 'Iniciativa da nova tarefa' }),
    ).toHaveValue(horta.id);
  });

  it('falls back to the first initiative when the remembered one is gone', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('bouleplan.quick-task-initiative', 'gone');
    await renderBoard();

    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));

    expect(
      within(column('A fazer')).getByRole('combobox', { name: 'Iniciativa da nova tarefa' }),
    ).toHaveValue(reforma.id);
  });

  it('keeps the field open when the chooser takes focus', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));

    await user.click(
      within(column('A fazer')).getByRole('combobox', { name: 'Iniciativa da nova tarefa' }),
    );

    expect(
      within(column('A fazer')).getByRole('textbox', { name: 'Título da nova tarefa' }),
    ).toBeVisible();
  });

  it('has no "+ Nova tarefa" without initiatives', async () => {
    serveTaskApi({ initiatives: [] });
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('region', { name: 'A fazer' });

    expect(screen.queryByRole('button', { name: '+ Nova tarefa' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'A fazer · 0' })).toBeVisible();
    });
  });
});

describe('changing the selection', () => {
  async function startDraft(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(column('A fazer')).getByRole('button', { name: '+ Nova tarefa' }));
    await user.type(
      within(column('A fazer')).getByRole('textbox', { name: 'Título da nova tarefa' }),
      'rascunho',
    );
  }

  const noDraft = () => {
    expect(
      screen.queryByRole('textbox', { name: 'Título da nova tarefa' }),
    ).not.toBeInTheDocument();
  };

  it('drops a draft typed for one initiative when another is selected', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}`);
    await startDraft(user);

    await user.click(
      within(screen.getByRole('navigation', { name: 'Iniciativas' })).getByRole('button', {
        name: /^Horta/,
      }),
    );

    noDraft();
    expect(backend.bodies).toEqual([]);
  });

  it('drops a draft typed for one phase when another is selected', async () => {
    const user = userEvent.setup();
    await renderBoard(`/?iniciativa=${reforma.id}&fase=${piso.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Piso' });
    await startDraft(user);

    await user.click(screen.getByRole('button', { name: 'Fase 1 · Demolição' }));

    await screen.findByRole('heading', { level: 1, name: 'Demolição' });
    noDraft();
  });

  it('drops a draft when going to "Todas as tarefas"', async () => {
    const user = userEvent.setup();
    await renderBoard(`/?iniciativa=${reforma.id}`);
    await startDraft(user);

    await user.click(screen.getByRole('button', { name: 'Todas as tarefas' }));

    noDraft();
  });

  it('drops the error message of the previous selection', async () => {
    const user = userEvent.setup();
    const backend = await renderBoard(`/?iniciativa=${reforma.id}`);
    backend.failing.add('PATCH');
    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Lixar parede' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'P1' }));
    expect(
      await screen.findByText('Não foi possível mudar a prioridade. Tente de novo.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Todas as tarefas' }));

    expect(
      screen.queryByText('Não foi possível mudar a prioridade. Tente de novo.'),
    ).not.toBeInTheDocument();
  });
});
