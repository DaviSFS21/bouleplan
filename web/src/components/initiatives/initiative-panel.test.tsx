import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Initiative } from '@/api/types';
import { formatDeadline, localToday } from '@/components/deadline-field/deadline-field';
import { initiative, epic, problemResponse, task } from '@/test/fixtures';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { InitiativePanel } from './initiative-panel';
import { InitiativesScreen } from './initiatives-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const reforma = initiative({ createdAt: '2026-10-12T10:00:00-03:00' });
const horta = initiative({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Horta',
  color: 'verde',
});

interface Backend {
  items: Initiative[];
  patches: Record<string, unknown>[];
  calls: string[];
}

function serve(initial: Initiative[]): Backend {
  const backend: Backend = { items: [...initial], patches: [], calls: [] };
  const parked = new Map<string, Initiative>();
  const park = (id: string, kind: string) => {
    backend.calls.push(`${kind} ${id}`);
    const found = backend.items.find((item) => item.id === id);
    if (found) parked.set(id, found);
    backend.items = backend.items.filter((item) => item.id !== id);
    return found;
  };
  const unpark = (id: string, kind: string) => {
    backend.calls.push(`${kind} ${id}`);
    const found = parked.get(id);
    if (found) backend.items.push(found);
    return found;
  };
  server.use(
    http.get('*/api/initiatives', () => HttpResponse.json(backend.items)),
    http.get('*/api/tasks', () => HttpResponse.json([])),
    http.get('*/api/initiatives/:id/epics', () => HttpResponse.json([])),
    http.patch('*/api/initiatives/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      backend.patches.push(body);
      const index = backend.items.findIndex((item) => item.id === params.id);
      const updated = { ...backend.items[index], ...body } as Initiative;
      backend.items[index] = updated;
      return HttpResponse.json(updated);
    }),
    http.post('*/api/initiatives/:id/archive', ({ params }) =>
      HttpResponse.json(park(String(params.id), 'archive')),
    ),
    http.post('*/api/initiatives/:id/unarchive', ({ params }) =>
      HttpResponse.json(unpark(String(params.id), 'unarchive')),
    ),
    http.delete('*/api/initiatives/:id', ({ params }) => {
      park(String(params.id), 'delete');
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/initiatives/:id/restore', ({ params }) =>
      HttpResponse.json(unpark(String(params.id), 'restore')),
    ),
  );
  return backend;
}

function detailsUrl(id: string) {
  return `/?iniciativa=${id}&detalhes=1`;
}

async function renderOpen(items: Initiative[] = [reforma, horta], id = reforma.id) {
  const backend = serve(items);
  navigateTo(detailsUrl(id));
  renderWithQuery(<InitiativesScreen />);
  const panel = await screen.findByRole('complementary', { name: 'Iniciativa' });
  return { backend, panel };
}

function index() {
  return screen.getByRole('navigation', { name: 'Iniciativas' });
}

beforeEach(() => {
  navigateTo('/');
});

afterEach(() => {
  navigateTo('/');
});

describe('opening and closing the panel', () => {
  it('opens from the board title and keeps the state in the URL', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    const title = await screen.findByRole('button', { name: 'Reforma', expanded: false });

    await user.click(title);

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&detalhes=1`);
    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Reforma', expanded: true })).toBeInTheDocument();
  });

  it('is open after a reload with the details parameter', async () => {
    const { panel } = await renderOpen();

    expect(within(panel).getByRole('textbox', { name: 'Nome da iniciativa' })).toHaveValue(
      'Reforma',
    );
    expect(panel).toHaveTextContent('Iniciativa');
  });

  it('stays closed without a selected initiative', async () => {
    serve([reforma]);
    navigateTo('/?detalhes=1');
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('closes with the close button, removes the parameter and returns focus to the opener', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Reforma', expanded: false }));

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reforma', expanded: false })).toHaveFocus();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    await renderOpen();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
  });

  it('follows the selection to another initiative without moving focus into the panel', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(window.location.search).toBe(detailsUrl(horta.id).slice(1));
    expect(screen.getByRole('complementary')).toBe(panel);
    expect(within(panel).getByRole('textbox', { name: 'Nome da iniciativa' })).toHaveValue('Horta');
    expect(within(index()).getByRole('button', { name: /^Horta/ })).toHaveFocus();
  });

  it('closes when going back to all tasks', async () => {
    const user = userEvent.setup();
    await renderOpen();

    await user.click(within(index()).getByRole('button', { name: 'Todas as tarefas' }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('index action menus', () => {
  it('has a menu trigger per initiative with the full set of actions', async () => {
    const user = userEvent.setup();
    serve([reforma, horta]);
    renderWithQuery(<InitiativesScreen />);

    await user.click(await screen.findByRole('button', { name: 'Ações de Horta' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Abrir detalhes',
      'Editar nome',
      'Cor…',
      'Novo épico',
      'Arquivar',
      'Excluir',
    ]);
    expect(screen.getByRole('button', { name: 'Ações de Reforma' })).toBeInTheDocument();
  });

  it('"Abrir detalhes" opens the panel for that initiative', async () => {
    const user = userEvent.setup();
    serve([reforma, horta]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Horta' }));

    await user.click(screen.getByRole('menuitem', { name: 'Abrir detalhes' }));

    expect(window.location.search).toBe(detailsUrl(horta.id).slice(1));
    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeInTheDocument();
  });

  it('"Editar nome" opens the panel with the title focused', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));

    await user.click(screen.getByRole('menuitem', { name: 'Editar nome' }));

    expect(await screen.findByRole('textbox', { name: 'Nome da iniciativa' })).toHaveFocus();
  });

  it('"Editar nome" focuses the title again when the panel is already open', async () => {
    const user = userEvent.setup();
    await renderOpen([reforma]);
    expect(screen.getByRole('textbox', { name: 'Nome da iniciativa' })).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar nome' }));

    expect(screen.getByRole('textbox', { name: 'Nome da iniciativa' })).toHaveFocus();
  });

  it('"Cor…" opens the panel with the palette open and the current color focused', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));

    await user.click(screen.getByRole('menuitem', { name: 'Cor…' }));

    expect(await screen.findByRole('radiogroup', { name: 'Cor da iniciativa' })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Turquesa' })).toHaveFocus();
    });
  });
});

describe('editing in the panel', () => {
  it('renames, trimming, and updates the index and the board', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    const title = within(panel).getByRole('textbox', { name: 'Nome da iniciativa' });

    await user.clear(title);
    await user.type(title, '  Casa nova ');
    await user.tab();

    await waitFor(() => {
      expect(within(index()).getByRole('button', { name: /^Casa nova/ })).toBeInTheDocument();
    });
    expect(backend.patches).toEqual([{ name: 'Casa nova' }]);
    expect(screen.getByRole('heading', { level: 1, name: 'Casa nova' })).toBeVisible();
  });

  it('does not save an unchanged name', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();

    await user.click(within(panel).getByRole('textbox', { name: 'Nome da iniciativa' }));
    await user.tab();

    expect(backend.patches).toEqual([]);
  });

  it('rejects a blank name without a request and reverts the field', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    const title = within(panel).getByRole('textbox', { name: 'Nome da iniciativa' });

    await user.clear(title);
    await user.tab();

    expect(within(panel).getByRole('alert')).toHaveTextContent('Dê um nome à iniciativa.');
    expect(title).toHaveValue('Reforma');
    expect(backend.patches).toEqual([]);
  });

  it('shows the server message under the field and keeps the typed text', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(
      http.patch('*/api/initiatives/:id', () =>
        problemResponse('initiative.name.invalid-characters'),
      ),
    );
    const title = within(panel).getByRole('textbox', { name: 'Nome da iniciativa' });

    await user.type(title, ' X');
    await user.tab();

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'O nome tem caracteres inválidos.',
    );
    expect(title).toHaveValue('Reforma X');
  });

  it('changes the color from the palette, closes it and returns focus to the color button', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    const button = within(panel).getByRole('button', { name: 'Turquesa', expanded: false });
    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();

    await user.click(button);
    expect(
      within(panel).getByRole('button', { name: 'Turquesa', expanded: true }),
    ).toBeInTheDocument();
    await user.click(within(panel).getByRole('radio', { name: 'Roxo' }));

    await waitFor(() => {
      expect(within(panel).getByRole('button', { name: 'Roxo', expanded: false })).toHaveFocus();
    });
    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(backend.patches).toEqual([{ color: 'roxo' }]);
    const dot = within(index())
      .getByRole('button', { name: /^Reforma/ })
      .querySelector<HTMLElement>('[style]');
    expect(dot?.style.getPropertyValue('--ini')).toBe('var(--ini-roxo)');
  });

  it('keeps the same color without a request and closes the palette', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.click(within(panel).getByRole('radio', { name: 'Turquesa' }));

    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(backend.patches).toEqual([]);
  });

  it('closes the palette with Escape without closing the panel', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.keyboard('{Escape}');

    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Turquesa' })).toHaveFocus();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('toggles the palette closed from the color button', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    const button = within(panel).getByRole('button', { name: 'Turquesa' });

    await user.click(button);
    await user.click(button);

    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('shows a color save failure under the field', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(
      http.patch('*/api/initiatives/:id', () => problemResponse('initiative.color.invalid')),
    );
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.click(within(panel).getByRole('radio', { name: 'Roxo' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente de novo.',
    );
  });

  it('sets the overall deadline from the calendar and shows it', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();

    await user.click(within(panel).getByRole('button', { name: 'Prazo geral: sem prazo' }));
    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    const today = localToday();
    expect(
      await within(panel).findByRole('button', { name: `Prazo geral: ${formatDeadline(today)}` }),
    ).toBeInTheDocument();
    expect(backend.patches).toEqual([{ overallDeadline: today }]);
  });

  it('removes the deadline with "Remover prazo"', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen([{ ...reforma, overallDeadline: '2099-12-18' }]);

    await user.click(within(panel).getByRole('button', { name: 'Remover prazo' }));

    expect(
      await within(panel).findByRole('button', { name: 'Prazo geral: sem prazo' }),
    ).toBeInTheDocument();
    expect(backend.patches).toEqual([{ overallDeadline: null }]);
  });

  it('shows a deadline save failure under the field', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(http.patch('*/api/initiatives/:id', () => problemResponse('internal', 500)));

    await user.click(within(panel).getByRole('button', { name: 'Prazo geral: sem prazo' }));
    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar. Tente de novo.',
    );
  });

  it('saves the description on blur, and sends null when it is emptied', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    const description = within(panel).getByRole('textbox', { name: 'Descrição' });
    expect(description).toHaveAttribute('placeholder', 'Adicionar descrição');
    expect(description).toHaveAttribute('maxlength', '10000');

    await user.type(description, 'Trocar o piso');
    await user.tab();
    await waitFor(() => {
      expect(backend.patches).toEqual([{ description: 'Trocar o piso' }]);
    });
    await user.clear(description);
    await user.tab();

    await waitFor(() => {
      expect(backend.patches).toEqual([{ description: 'Trocar o piso' }, { description: null }]);
    });
  });

  it('keeps the text and shows the message when saving the description fails', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(
      http.patch('*/api/initiatives/:id', () => problemResponse('initiative.description.too-long')),
    );
    const description = within(panel).getByRole('textbox', { name: 'Descrição' });

    await user.type(description, 'Muito longa');
    await user.tab();

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Use no máximo 10.000 caracteres.',
    );
    expect(description).toHaveValue('Muito longa');
  });

  it('shows that there are no tasks yet', async () => {
    const { panel } = await renderOpen();

    expect(await within(panel).findByText('sem tarefas ainda')).toBeVisible();
  });

  it('shows the real progress and the count of each epic', async () => {
    serve([reforma, horta]);
    const piso = epic({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Piso' });
    server.use(
      http.get('*/api/initiatives/:id/epics', () => HttpResponse.json([piso])),
      http.get('*/api/tasks', () =>
        HttpResponse.json([
          task({ id: 'a', status: 'done' }),
          task({ id: 'b', epicId: piso.id }),
          task({ id: 'c', initiativeId: horta.id, status: 'done' }),
        ]),
      ),
    );
    navigateTo(detailsUrl(reforma.id));
    renderWithQuery(<InitiativesScreen />);
    const panel = await screen.findByRole('complementary', { name: 'Iniciativa' });

    expect(await within(panel).findByText('1 de 2 feitas')).toBeVisible();
    expect(
      within(panel).getByRole('progressbar', { name: 'Progresso de Reforma' }),
    ).toHaveAttribute('aria-valuenow', '1');
    expect(
      await within(panel).findByRole('button', { name: 'Épico 1 · Piso' }),
    ).toHaveAccessibleDescription('0/1');
  });
});

describe('archive and delete', () => {
  it.each([
    ['index', 'Arquivar', 'Iniciativa arquivada', 'archive', 'unarchive'],
    ['index', 'Excluir', 'Iniciativa excluída', 'delete', 'restore'],
    ['panel', 'Arquivar', 'Iniciativa arquivada', 'archive', 'unarchive'],
    ['panel', 'Excluir', 'Iniciativa excluída', 'delete', 'restore'],
  ] as const)(
    'from the %s menu, %s leaves at once, shows a toast and undo brings it back selected',
    async (origin, action, message, call, undoCall) => {
      const user = userEvent.setup();
      const { backend, panel } = await renderOpen();
      const trigger =
        origin === 'index'
          ? within(index()).getByRole('button', { name: 'Ações de Reforma' })
          : within(panel).getByRole('button', { name: 'Ações da iniciativa' });

      await user.click(trigger);
      await user.click(screen.getByRole('menuitem', { name: action }));

      expect(await screen.findByText(message)).toBeVisible();
      expect(backend.calls).toEqual([`${call} ${reforma.id}`]);
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      expect(window.location.search).toBe('');
      expect(screen.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();
      expect(within(index()).queryByRole('button', { name: /^Reforma/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
      });
      expect(backend.calls).toEqual([`${call} ${reforma.id}`, `${undoCall} ${reforma.id}`]);
      expect(within(index()).getByRole('button', { name: /^Reforma/ })).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    },
  );

  it.each([
    ['Arquivar', 'Não foi possível arquivar a iniciativa. Tente de novo.'],
    ['Excluir', 'Não foi possível excluir a iniciativa. Tente de novo.'],
  ] as const)('shows an inline alert, not a toast, when %s fails', async (action, message) => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(
      http.post('*/api/initiatives/:id/archive', () => problemResponse('http.404', 404)),
      http.delete('*/api/initiatives/:id', () => problemResponse('http.404', 404)),
    );

    await user.click(within(panel).getByRole('button', { name: 'Ações da iniciativa' }));
    await user.click(screen.getByRole('menuitem', { name: action }));

    expect(await within(index()).findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('clears the inline alert on the next attempt', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    server.use(
      http.post('*/api/initiatives/:id/archive', () => problemResponse('http.404', 404), {
        once: true,
      }),
    );
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await within(index()).findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await waitFor(() => {
      expect(within(index()).queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows an alert when undo fails', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    server.use(
      http.post('*/api/initiatives/:id/unarchive', () => problemResponse('http.404', 404)),
    );
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Não foi possível desfazer. Tente de novo.',
    );
  });
});

describe('InitiativePanel footer', () => {
  it('shows the creation date and the relative change time', () => {
    renderWithQuery(
      <InitiativePanel
        initiative={{ ...reforma, updatedAt: '2026-11-17T11:58:00-03:00' }}
        epics={[]}
        tasks={[]}
        selectedEpicId={null}
        onSelectEpic={vi.fn()}
        onCreateEpic={vi.fn()}
        opener={{ current: null }}
        fallbackFocus={() => null}
        request={null}
        onRequestHandled={vi.fn()}
        now={new Date('2026-11-17T12:00:00-03:00')}
        onClose={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onSaved={vi.fn()}
        onSaveFailed={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Criada em 12 out · alterada há 2 min · salva automaticamente'),
    ).toBeVisible();
  });
});

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('panel intents are bound to their initiative', () => {
  it('does not replay "Cor…" on another initiative', async () => {
    const user = userEvent.setup();
    serve([reforma, horta]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cor…' }));
    expect(await screen.findByRole('radiogroup')).toBeVisible();

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(window.location.search).toBe(detailsUrl(horta.id).slice(1));
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(index()).getByRole('button', { name: /^Horta/ })).toHaveFocus();
  });

  it('does not replay "Editar nome" on another initiative', async () => {
    const user = userEvent.setup();
    serve([reforma, horta]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar nome' }));
    expect(await screen.findByRole('textbox', { name: 'Nome da iniciativa' })).toHaveFocus();

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(screen.getByRole('textbox', { name: 'Nome da iniciativa' })).toHaveValue('Horta');
    expect(screen.getByRole('textbox', { name: 'Nome da iniciativa' })).not.toHaveFocus();
  });

  it('does not replay the intent when the same details URL is visited again', async () => {
    const user = userEvent.setup();
    serve([reforma]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cor…' }));
    await screen.findByRole('radiogroup');
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    navigateTo(detailsUrl(reforma.id));

    expect(await screen.findByRole('complementary')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

describe('archive and delete of a non-selected initiative', () => {
  it.each([
    ['Arquivar', 'Iniciativa arquivada', 'archive', 'unarchive'],
    ['Excluir', 'Iniciativa excluída', 'delete', 'restore'],
  ] as const)(
    '%s keeps the board and selection, and undo leaves them alone',
    async (action, message, call, undoCall) => {
      const user = userEvent.setup();
      const backend = serve([reforma, horta]);
      navigateTo(`/?iniciativa=${reforma.id}`);
      renderWithQuery(<InitiativesScreen />);
      await user.click(await screen.findByRole('button', { name: 'Ações de Horta' }));

      await user.click(screen.getByRole('menuitem', { name: action }));

      expect(await screen.findByText(message)).toBeVisible();
      expect(backend.calls).toEqual([`${call} ${horta.id}`]);
      expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
      expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
      expect(within(index()).queryByRole('button', { name: /^Horta/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(within(index()).getByRole('button', { name: /^Horta/ })).toBeInTheDocument();
      });
      expect(backend.calls).toEqual([`${call} ${horta.id}`, `${undoCall} ${horta.id}`]);
      expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
      expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
    },
  );

  it('keeps an open panel for the selected initiative', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();

    await user.click(screen.getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText(/^Iniciativa (arquivada|excluída)/);

    expect(panel).toBeInTheDocument();
    expect(window.location.search).toBe(detailsUrl(reforma.id).slice(1));
  });
});

describe('focus after archive or delete', () => {
  const casa = initiative({ id: '33333333-3333-4333-8333-333333333333', name: 'Casa' });

  it.each([
    ['the next item', 'Reforma', /^Horta/],
    ['the previous item when it was the last', 'Casa', /^Horta/],
  ])('moves to %s', async (_, archived, expected) => {
    const user = userEvent.setup();
    serve([reforma, horta, casa]);
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: `Ações de ${archived}` }));

    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await screen.findByText(/^Iniciativa (arquivada|excluída)/);
    expect(within(index()).getByRole('button', { name: expected })).toHaveFocus();
  });

  it('moves to "Todas as tarefas" when the list becomes empty', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen([reforma]);

    await user.click(within(panel).getByRole('button', { name: 'Ações da iniciativa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    await screen.findByText(/^Iniciativa (arquivada|excluída)/);
    expect(within(index()).getByRole('button', { name: 'Todas as tarefas' })).toHaveFocus();
  });

  it('undoes with Ctrl+Z while the toast shows', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    await user.click(within(panel).getByRole('button', { name: 'Ações da iniciativa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText(/^Iniciativa (arquivada|excluída)/);

    await user.keyboard('{Control>}z{/Control}');

    await waitFor(() => {
      expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    });
    expect(backend.calls).toEqual([`archive ${reforma.id}`, `unarchive ${reforma.id}`]);
  });
});

describe('autosave failures and the inline alert', () => {
  it('surfaces a failed save after the panel closed', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    const gate = deferred();
    server.use(
      http.patch('*/api/initiatives/:id', async () => {
        await gate.promise;
        return problemResponse('internal', 500);
      }),
    );

    await user.type(within(panel).getByRole('textbox', { name: 'Descrição' }), 'Texto');
    await user.click(within(panel).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    gate.release();

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar a descrição. Tente de novo.',
    );
  });

  it('surfaces a failed save for the previous initiative after the selection moved', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    const gate = deferred();
    server.use(
      http.patch('*/api/initiatives/:id', async () => {
        await gate.promise;
        return problemResponse('internal', 500);
      }),
    );

    await user.type(within(panel).getByRole('textbox', { name: 'Nome da iniciativa' }), ' X');
    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));
    gate.release();

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o nome. Tente de novo.',
    );
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the alert on navigation', async () => {
    const user = userEvent.setup();
    serve([reforma, horta]);
    server.use(
      http.post('*/api/initiatives/:id/unarchive', () => problemResponse('http.404', 404)),
    );
    renderWithQuery(<InitiativesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await within(index()).findByRole('alert');

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(within(index()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the alert after the next successful save', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(http.post('*/api/initiatives/:id/archive', () => problemResponse('http.404', 404)));
    await user.click(within(panel).getByRole('button', { name: 'Ações da iniciativa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await within(index()).findByRole('alert');

    await user.type(within(panel).getByRole('textbox', { name: 'Descrição' }), 'ok');
    await user.tab();

    await waitFor(() => {
      expect(within(index()).queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('optimistic color and trimmed names', () => {
  it('shows the chosen color before the response arrives', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    const gate = deferred();
    server.use(
      http.patch('*/api/initiatives/:id', async ({ request, params }) => {
        await gate.promise;
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...reforma, id: String(params.id), ...body });
      }),
    );
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.click(within(panel).getByRole('radio', { name: 'Roxo' }));

    expect(within(panel).getByRole('button', { name: 'Roxo' })).toBeInTheDocument();
    gate.release();
    await waitFor(() => {
      expect(within(panel).getByRole('button', { name: 'Roxo' })).toBeInTheDocument();
    });
  });

  it('goes back to the saved color when the save fails', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    server.use(http.patch('*/api/initiatives/:id', () => problemResponse('internal', 500)));
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.click(within(panel).getByRole('radio', { name: 'Roxo' }));

    expect(await within(panel).findByRole('alert')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Turquesa' })).toBeInTheDocument();
  });

  it('moves an arrow selection without saving, and Escape cancels', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.keyboard('{ArrowRight}');
    expect(within(panel).getByRole('radio', { name: 'Azul' })).toBeChecked();
    expect(backend.patches).toEqual([]);
    await user.keyboard('{Escape}');

    expect(within(panel).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(backend.patches).toEqual([]);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('chooses the arrow-selected color with Enter', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));

    await user.keyboard('{ArrowRight}{Enter}');

    await waitFor(() => {
      expect(backend.patches).toEqual([{ color: 'azul' }]);
    });
  });

  it('does not send a request when only whitespace changed in the name', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();
    const title = within(panel).getByRole('textbox', { name: 'Nome da iniciativa' });

    await user.type(title, '   ');
    await user.tab();

    expect(backend.patches).toEqual([]);
    expect(title).toHaveValue('Reforma');
  });
});

describe('description trimming and per-initiative pending color', () => {
  it('maps whitespace-only to null and does not patch for trailing whitespace only', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen([{ ...reforma, description: 'Piso' }, horta]);
    const description = within(panel).getByRole('textbox', { name: 'Descrição' });

    await user.type(description, '   ');
    await user.tab();
    expect(backend.patches).toEqual([]);
    expect(description).toHaveValue('Piso');

    await user.clear(description);
    await user.type(description, '   ');
    await user.tab();

    await waitFor(() => {
      expect(backend.patches).toEqual([{ description: null }]);
    });
  });

  it('sends the trimmed description', async () => {
    const user = userEvent.setup();
    const { backend, panel } = await renderOpen();

    await user.type(within(panel).getByRole('textbox', { name: 'Descrição' }), '  Piso novo  ');
    await user.tab();

    await waitFor(() => {
      expect(backend.patches).toEqual([{ description: 'Piso novo' }]);
    });
  });

  it('keeps another initiative optimistic color when an earlier save settles', async () => {
    const user = userEvent.setup();
    const { panel } = await renderOpen();
    const gates = new Map([
      [reforma.id, deferred()],
      [horta.id, deferred()],
    ]);
    server.use(
      http.patch('*/api/initiatives/:id', async ({ request, params }) => {
        await gates.get(String(params.id))?.promise;
        const body = (await request.json()) as Record<string, unknown>;
        const base = params.id === reforma.id ? reforma : horta;
        return HttpResponse.json({ ...base, ...body });
      }),
    );
    await user.click(within(panel).getByRole('button', { name: 'Turquesa' }));
    await user.click(within(panel).getByRole('radio', { name: 'Roxo' }));
    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));
    await user.click(within(panel).getByRole('button', { name: 'Verde' }));
    await user.click(within(panel).getByRole('radio', { name: 'Rosa' }));
    expect(within(panel).getByRole('button', { name: 'Rosa' })).toBeInTheDocument();

    gates.get(reforma.id)?.release();
    await waitFor(() => {
      expect(within(index()).getByRole('button', { name: /^Reforma/ })).toBeInTheDocument();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(within(panel).getByRole('button', { name: 'Rosa' })).toBeInTheDocument();
    gates.get(horta.id)?.release();
  });
});
