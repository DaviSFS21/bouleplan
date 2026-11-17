import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Initiative, Phase } from '@/api/types';
import { initiative, phase, problemResponse } from '@/test/fixtures';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { InitiativesScreen } from './initiatives-screen';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const reforma = initiative();
const horta = initiative({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Horta',
  color: 'verde',
});
const demolition = phase();
const flooring = phase({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Piso',
  createdAt: '2026-01-02T10:00:00-03:00',
});
const painting = phase({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Pintura',
  createdAt: '2026-01-03T10:00:00-03:00',
});
const seeds = phase({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  initiativeId: horta.id,
  name: 'Sementes',
});

interface Backend {
  initiatives: Initiative[];
  phases: Phase[];
  calls: string[];
  bodies: unknown[];
}

function serve(initiatives: Initiative[], phases: Phase[]): Backend {
  const backend: Backend = { initiatives, phases: [...phases], calls: [], bodies: [] };
  const parked = new Map<string, Phase>();
  const find = (id: unknown) => backend.phases.find((item) => item.id === id);
  const park = (id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    const found = find(id);
    if (found) parked.set(found.id, found);
    backend.phases = backend.phases.filter((item) => item.id !== id);
    return found;
  };
  const unpark = (id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    const found = parked.get(String(id));
    if (found) backend.phases.push(found);
    return found;
  };
  server.use(
    http.get('*/api/initiatives', () => HttpResponse.json(backend.initiatives)),
    http.post('*/api/initiatives/:id/archive', ({ params }) =>
      HttpResponse.json(backend.initiatives.find((item) => item.id === params.id)),
    ),
    http.post('*/api/initiatives/:id/unarchive', ({ params }) =>
      HttpResponse.json(backend.initiatives.find((item) => item.id === params.id)),
    ),
    http.delete('*/api/initiatives/:id', () => new HttpResponse(null, { status: 204 })),
    http.get('*/api/initiatives/:id/phases', ({ params }) =>
      HttpResponse.json(
        backend.phases
          .filter((item) => item.initiativeId === params.id)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      ),
    ),
    http.post('*/api/initiatives/:id/phases', async ({ request, params }) => {
      const body = (await request.json()) as { name: string };
      backend.bodies.push(body);
      const created = phase({
        id: `eeeeeeee-eeee-4eee-8eee-${String(backend.phases.length).padStart(12, '0')}`,
        initiativeId: String(params.id),
        name: body.name,
        createdAt: `2026-02-${String(10 + backend.phases.length)}T10:00:00-03:00`,
      });
      backend.phases.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch('*/api/phases/:id', async ({ request, params }) => {
      const body = (await request.json()) as { name: string };
      backend.bodies.push(body);
      const index = backend.phases.findIndex((item) => item.id === params.id);
      const updated = { ...backend.phases[index], ...body } as Phase;
      backend.phases[index] = updated;
      return HttpResponse.json(updated);
    }),
    http.post('*/api/phases/:id/archive', ({ params }) =>
      HttpResponse.json(park(params.id, 'archive')),
    ),
    http.post('*/api/phases/:id/unarchive', ({ params }) =>
      HttpResponse.json(unpark(params.id, 'unarchive')),
    ),
    http.delete('*/api/phases/:id', ({ params }) => {
      park(params.id, 'delete');
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/phases/:id/restore', ({ params }) =>
      HttpResponse.json(unpark(params.id, 'restore')),
    ),
  );
  return backend;
}

function index() {
  return screen.getByRole('navigation', { name: 'Iniciativas' });
}

function phaseButton(label: string) {
  return within(index()).getByRole('button', { name: label });
}

async function openInitiative(user: ReturnType<typeof userEvent.setup>, name: string) {
  const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });
  await user.click(within(nav).getByRole('button', { name: new RegExp(`^${name}`) }));
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string, item: string) {
  await user.click(await within(index()).findByRole('button', { name: `Ações da fase ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: item }));
}

beforeEach(() => {
  navigateTo('/');
});

afterEach(() => {
  navigateTo('/');
});

describe('phases in the index', () => {
  it('opens the phases of the selected initiative only, numbered in order', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition, flooring, seeds]);
    renderWithQuery(<InitiativesScreen />);

    await openInitiative(user, 'Reforma');

    expect(
      await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }),
    ).toBeVisible();
    expect(phaseButton('Fase 2 · Piso')).toBeVisible();
    expect(within(index()).queryByText(/Sementes/)).not.toBeInTheDocument();

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(await within(index()).findByRole('button', { name: 'Fase 1 · Sementes' })).toBeVisible();
    expect(within(index()).queryByText(/Demolição/)).not.toBeInTheDocument();
  });

  it('shows no phases while "Todas as tarefas" is selected', async () => {
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });

    expect(within(index()).queryByText(/Demolição/)).not.toBeInTheDocument();
    expect(within(index()).queryByRole('button', { name: '+ Nova fase' })).not.toBeInTheDocument();
  });

  it('shows a note when the phases fail to load', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    server.use(http.get('*/api/initiatives/:id/phases', () => problemResponse('internal', 500)));
    renderWithQuery(<InitiativesScreen />);

    await openInitiative(user, 'Reforma');

    expect(await within(index()).findByText('Não foi possível carregar as fases.')).toBeVisible();
    expect(within(index()).queryByRole('button', { name: '+ Nova fase' })).not.toBeInTheDocument();
  });

  it('filters by a phase, keeps "detalhes" and shows the path in the board header', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Fase 2 · Piso' });
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    expect(window.location.search).toContain('detalhes=1');

    await user.click(phaseButton('Fase 2 · Piso'));

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&detalhes=1&fase=${flooring.id}`);
    expect(phaseButton('Fase 2 · Piso')).toHaveAttribute('aria-pressed', 'true');
    expect(phaseButton('Fase 1 · Demolição')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    const overline = screen.getByRole('heading', { level: 1 }).previousElementSibling;
    expect(overline).toHaveTextContent('Reforma');
    expect(within(overline as HTMLElement).getByRole('button', { name: 'Reforma' })).toBeVisible();
  });

  it('opens the panel from the initiative name in the phase path', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    const main = screen.getByRole('main');
    await user.click(within(main).getByRole('button', { name: 'Reforma', expanded: false }));

    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
    expect(window.location.search).toContain(`fase=${demolition.id}`);
  });

  it('clears the filter when the phase is clicked again', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    await user.click(phaseButton('Fase 1 · Demolição'));

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    expect(phaseButton('Fase 1 · Demolição')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
  });

  it('restores the filter from the URL and ignores an unknown phase', async () => {
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}&fase=${demolition.id}`);
    const { unmount } = renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Demolição' })).toBeVisible();
    unmount();

    navigateTo(`/?iniciativa=${reforma.id}&fase=ffffffff-ffff-4fff-8fff-ffffffffffff`);
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
    expect(
      await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('drops the phase filter when an initiative is selected', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));
    expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
  });

  it('drops the phase filter when opening another initiative panel from its menu', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Abrir detalhes' }));

    expect(window.location.search).toBe(`?iniciativa=${horta.id}&detalhes=1`);
  });
});

describe('creating phases in the index', () => {
  it('creates phases in order, keeps the field open and keeps the filter', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: '+ Nova fase' }));
    const field = within(index()).getByRole('textbox', { name: 'Nome da nova fase' });
    expect(field).toHaveAttribute('placeholder', 'Nome da fase');
    expect(field).toHaveAttribute('maxlength', '200');
    await user.type(field, '  Piso {Enter}');

    expect(await within(index()).findByRole('button', { name: 'Fase 2 · Piso' })).toBeVisible();
    expect(backend.bodies).toEqual([{ name: 'Piso' }]);
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&fase=${demolition.id}`);
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();

    await user.type(field, 'Pintura{Enter}');
    expect(await within(index()).findByRole('button', { name: 'Fase 3 · Pintura' })).toBeVisible();
  });

  it('blocks a blank name, cancels with Escape and closes when blurred empty', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: '+ Nova fase' }));
    const field = within(index()).getByRole('textbox', { name: 'Nome da nova fase' });

    await user.type(field, '   {Enter}');
    expect(await within(index()).findByRole('alert')).toHaveTextContent('Dê um nome à fase.');
    expect(backend.bodies).toEqual([]);

    await user.type(field, 'Algo{Escape}');
    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(index()).getByRole('button', { name: '+ Nova fase' })).toHaveFocus();

    await user.click(within(index()).getByRole('button', { name: '+ Nova fase' }));
    await user.tab();
    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the server message and keeps the field on failure', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    server.use(
      http.post('*/api/initiatives/:id/phases', () =>
        problemResponse('phase.name.invalid-characters'),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: '+ Nova fase' }));

    await user.type(within(index()).getByRole('textbox'), 'Piso{Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'O nome tem caracteres inválidos.',
    );
    expect(within(index()).getByRole('textbox')).toHaveValue('Piso');
  });
});

describe('renaming a phase', () => {
  it('edits the name inline from the menu and returns focus to the row', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Piso', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome da fase' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, ' Contrapiso {Enter}');

    expect(
      await within(index()).findByRole('button', { name: 'Fase 2 · Contrapiso' }),
    ).toHaveFocus();
    expect(backend.bodies).toEqual([{ name: 'Contrapiso' }]);
    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancels with Escape without saving', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    await user.type(within(index()).getByRole('textbox', { name: 'Nome da fase' }), 'x{Escape}');

    expect(phaseButton('Fase 1 · Demolição')).toHaveFocus();
    expect(backend.bodies).toEqual([]);
  });

  it('saves when focus leaves the field and does not steal focus', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    await user.type(within(index()).getByRole('textbox', { name: 'Nome da fase' }), '!');
    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));

    expect(
      await within(index()).findByRole('button', { name: 'Fase 1 · Demolição!' }),
    ).not.toHaveFocus();
    expect(backend.bodies).toEqual([{ name: 'Demolição!' }]);
  });

  it('does not return focus to the row when Enter only confirms a composition', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome da fase' });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyUp(field, { key: 'Enter' });
    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));

    expect(phaseButton('Fase 1 · Demolição')).not.toHaveFocus();
  });

  it('reports a blank name and keeps the old one', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome da fase' });
    await user.clear(field);
    await user.type(field, '  {Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent('Dê um nome à fase.');
    expect(phaseButton('Fase 1 · Demolição')).toBeVisible();
    expect(backend.bodies).toEqual([]);
  });

  it('reports a server failure', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    server.use(http.patch('*/api/phases/:id', () => problemResponse('phase.name.too-long')));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    await user.type(within(index()).getByRole('textbox', { name: 'Nome da fase' }), 'x{Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Use no máximo 200 caracteres.',
    );
  });
});

describe('archiving and deleting a phase', () => {
  it.each([
    ['Arquivar', 'Fase arquivada', 'archive', 'unarchive'],
    ['Excluir', 'Fase excluída', 'delete', 'restore'],
  ])('%s applies at once and "Desfazer" brings it back', async (item, message, call, undoCall) => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', item);

    expect(await screen.findByText(message)).toBeVisible();
    await waitFor(() => {
      expect(within(index()).queryByText(/Demolição/)).not.toBeInTheDocument();
    });
    expect(phaseButton('Fase 1 · Piso')).toBeVisible();
    expect(backend.calls).toEqual([`${call} ${demolition.id}`]);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(
      await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }),
    ).toBeVisible();
    expect(backend.calls).toEqual([`${call} ${demolition.id}`, `${undoCall} ${demolition.id}`]);
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
  });

  it('undoes with Ctrl+Z', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await openMenu(user, 'Demolição', 'Arquivar');
    await screen.findByText('Fase arquivada');

    await user.keyboard('{Control>}z{/Control}');

    expect(
      await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }),
    ).toBeVisible();
  });

  it.each([
    ['Arquivar', 'Fase arquivada'],
    ['Excluir', 'Fase excluída'],
  ])('%s clears a filter on that phase and undo re-applies it', async (item, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 2 · Piso' }));
    expect(window.location.search).toContain(`fase=${flooring.id}`);

    await openMenu(user, 'Piso', item);
    await screen.findByText(message);

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&fase=${flooring.id}`);
  });

  it('keeps the filter on another phase and does not re-apply it on undo', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 2 · Piso' }));

    await openMenu(user, 'Demolição', 'Arquivar');
    await screen.findByText('Fase arquivada');
    expect(window.location.search).toContain(`fase=${flooring.id}`);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' });
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&fase=${flooring.id}`);
  });

  it('does not re-apply the filter when undo comes after leaving the initiative', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));
    await openMenu(user, 'Demolição', 'Arquivar');
    await screen.findByText('Fase arquivada');
    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
    });
  });

  it('moves focus to the neighbouring phase, else to the initiative item', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring, painting]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Piso', 'Arquivar');
    await waitFor(() => {
      expect(phaseButton('Fase 2 · Pintura')).toHaveFocus();
    });

    await openMenu(user, 'Pintura', 'Arquivar');
    await waitFor(() => {
      expect(phaseButton('Fase 1 · Demolição')).toHaveFocus();
    });

    await openMenu(user, 'Demolição', 'Excluir');
    await waitFor(() => {
      expect(within(index()).getByRole('button', { name: /^Reforma/ })).toHaveFocus();
    });
  });

  it.each([
    ['Arquivar', '*/api/phases/:id/archive', 'Não foi possível arquivar a fase. Tente de novo.'],
    ['Excluir', '*/api/phases/:id', 'Não foi possível excluir a fase. Tente de novo.'],
  ])('shows an alert when %s fails', async (item, path, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    const method = item === 'Excluir' ? http.delete : http.post;
    server.use(method(path, () => problemResponse('http.404', 404)));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', item);

    expect(await within(index()).findByRole('alert')).toHaveTextContent(message);
    expect(phaseButton('Fase 1 · Demolição')).toBeVisible();
    expect(screen.queryByText(/Fase (arquivada|excluída)/)).not.toBeInTheDocument();
  });

  it('shows an alert when undo fails', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    server.use(http.post('*/api/phases/:id/unarchive', () => problemResponse('http.404', 404)));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await openMenu(user, 'Demolição', 'Arquivar');

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Não foi possível desfazer. Tente de novo.',
    );
  });
});

describe('phases in the panel', () => {
  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' });
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    return screen.getByRole('complementary', { name: 'Iniciativa' });
  }

  it('lists the phases and filters the board when one is clicked', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    const panel = await openPanel(user);

    expect(within(panel).getByRole('heading', { level: 2, name: 'Fases' })).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: 'Fase 2 · Piso' }));

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&detalhes=1&fase=${flooring.id}`);
    expect(within(panel).getByRole('button', { name: 'Fase 2 · Piso' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  });

  it('says there are no phases yet', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await screen.findByRole('button', { name: 'Reforma', expanded: false }));

    const panel = screen.getByRole('complementary', { name: 'Iniciativa' });
    expect(await within(panel).findByText('Nenhuma fase ainda.')).toBeVisible();
  });

  it('creates a phase and keeps the field open', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    const panel = await openPanel(user);

    await user.click(within(panel).getByRole('button', { name: '+ Nova fase' }));
    const field = within(panel).getByRole('textbox', { name: 'Nome da nova fase' });
    await user.type(field, 'Piso{Enter}');

    expect(await within(panel).findByRole('button', { name: 'Fase 2 · Piso' })).toBeVisible();
    expect(backend.bodies).toEqual([{ name: 'Piso' }]);
    expect(field).toHaveValue('');
    expect(window.location.search).not.toContain('fase=');
  });
});

describe('archiving or deleting an initiative with phases', () => {
  it.each([
    ['Arquivar', 'Iniciativa arquivada, com 2 fases'],
    ['Excluir', 'Iniciativa excluída, com 2 fases'],
  ])('%s counts the phases in the notice', async (item, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Fase 2 · Piso' });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: item }));

    expect(await screen.findByText(message)).toBeVisible();
  });

  it('uses the singular for one phase', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada, com 1 fase')).toBeVisible();
  });

  it('keeps the plain notice without phases', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Nova fase' })).toBeVisible();
    });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada')).toBeVisible();
  });

  it('counts the phases even when they were never loaded', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada, com 1 fase')).toBeVisible();
  });

  it('keeps the plain notice when counting the phases fails', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    server.use(http.get('*/api/initiatives/:id/phases', () => problemResponse('internal', 500)));
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(await screen.findByText('Iniciativa excluída')).toBeVisible();
  });

  it('undo restores the selection together with the phase filter', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 2 · Piso' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText('Iniciativa arquivada, com 2 fases');
    expect(window.location.search).toBe('');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&fase=${flooring.id}`);
  });
});

describe('panel details', () => {
  async function openPanelFrom(user: ReturnType<typeof userEvent.setup>, opener: string) {
    const main = screen.getByRole('main');
    await user.click(within(main).getByRole('button', { name: opener, expanded: false }));
    return screen.getByRole('complementary', { name: 'Iniciativa' });
  }

  it('keeps the panel open when Escape cancels "+ Nova fase"', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    await user.click(await within(panel).findByRole('button', { name: '+ Nova fase' }));
    expect(within(panel).getByRole('textbox', { name: 'Nome da nova fase' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
    expect(
      within(panel).queryByRole('textbox', { name: 'Nome da nova fase' }),
    ).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '+ Nova fase' })).toHaveFocus();
  });

  it('returns focus to the overline button after filtering from the panel and closing', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');

    await user.click(await within(panel).findByRole('button', { name: 'Fase 1 · Demolição' }));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    const main = screen.getByRole('main');
    expect(within(main).getByRole('button', { name: 'Reforma' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Demolição' })).toBeVisible();
  });

  it('returns focus to the title button after clearing the filter and closing', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}&fase=${demolition.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Demolição' });
    await openPanelFrom(user, 'Reforma');

    await user.click(phaseButton('Fase 1 · Demolição'));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    const heading = screen.getByRole('heading', { level: 1, name: 'Reforma' });
    expect(within(heading).getByRole('button', { name: 'Reforma' })).toHaveFocus();
  });

  it('falls back to the index row when the panel was opened from the URL', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    navigateTo(`/?iniciativa=${reforma.id}&detalhes=1`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('complementary', { name: 'Iniciativa' });

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(within(index()).getByRole('button', { name: /^Reforma/ })).toHaveFocus();
  });

  it('does not carry a typed phase name over to another initiative', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma, horta], [demolition, seeds]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    await user.click(await within(panel).findByRole('button', { name: '+ Nova fase' }));
    await user.type(within(panel).getByRole('textbox', { name: 'Nome da nova fase' }), 'Piso');

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(await within(panel).findByRole('button', { name: 'Fase 1 · Sementes' })).toBeVisible();
    expect(
      within(panel).queryByRole('textbox', { name: 'Nome da nova fase' }),
    ).not.toBeInTheDocument();
    expect(backend.bodies).toEqual([]);
  });

  it('toggles the phase filter from the panel', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    const button = await within(panel).findByRole('button', { name: 'Fase 1 · Demolição' });

    await user.click(button);
    expect(window.location.search).toContain('fase=');
    await user.click(button);

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&detalhes=1`);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('"Nova fase" in the initiative menu', () => {
  it('selects the initiative, opens the field for it and focuses it', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma, horta], [demolition, seeds]);
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));

    const field = await within(nav).findByRole('textbox', { name: 'Nome da nova fase' });
    expect(field).toHaveFocus();
    expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
    await user.type(field, 'Colheita{Enter}');
    await within(nav).findByRole('button', { name: 'Fase 2 · Colheita' });
    expect(backend.phases.map((item) => item.initiativeId)).toEqual([
      reforma.id,
      horta.id,
      horta.id,
    ]);
  });

  it('keeps the phase filter when the initiative is already selected, and focuses the field again', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));
    await within(index()).findByRole('textbox', { name: 'Nome da nova fase' });
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&fase=${demolition.id}`);

    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));
    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));

    expect(
      await within(index()).findByRole('textbox', { name: 'Nome da nova fase' }),
    ).toHaveFocus();
  });

  it('applies the intent once and does not leave it pending for later', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    let broken = true;
    server.use(
      http.get('*/api/initiatives/:id/phases', ({ params }) =>
        broken && params.id === horta.id
          ? problemResponse('internal', 500)
          : HttpResponse.json(params.id === horta.id ? [seeds] : []),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));
    await within(nav).findByText('Não foi possível carregar as fases.');
    await user.click(within(nav).getByRole('button', { name: /^Reforma/ }));
    broken = false;
    await user.click(within(nav).getByRole('button', { name: /^Horta/ }));

    expect(await within(nav).findByRole('button', { name: 'Fase 1 · Sementes' })).toBeVisible();
    expect(within(nav).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not reopen the field after it was cancelled', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Fase 1 · Demolição' });
    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));
    await within(index()).findByRole('textbox', { name: 'Nome da nova fase' });

    await user.keyboard('{Escape}');
    await user.click(phaseButton('Fase 1 · Demolição'));

    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('guards and stale intents', () => {
  it('sends one archive request when "Arquivar" is chosen twice during the count wait', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    let archives = 0;
    server.use(
      http.get('*/api/initiatives/:id/phases', async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json([demolition]);
      }),
      http.post('*/api/initiatives/:id/archive', () => {
        archives += 1;
        return archives === 1 ? HttpResponse.json(reforma) : problemResponse('http.404', 404);
      }),
    );
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    for (let times = 0; times < 2; times += 1) {
      await user.click(within(nav).getByRole('button', { name: 'Ações de Reforma' }));
      await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    }

    expect(await screen.findByText('Iniciativa arquivada, com 1 fase')).toBeVisible();
    expect(archives).toBe(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not replay "Nova fase" after a failed phases load', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], []);
    let broken = true;
    server.use(
      http.get('*/api/initiatives/:id/phases', () =>
        broken ? problemResponse('internal', 500) : HttpResponse.json(backend.phases),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });
    await user.click(within(nav).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Nova fase' }));
    await within(nav).findByText('Não foi possível carregar as fases.');
    broken = false;

    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    const panel = screen.getByRole('complementary', { name: 'Iniciativa' });
    await user.click(within(panel).getByRole('button', { name: '+ Nova fase' }));
    await user.type(
      within(panel).getByRole('textbox', { name: 'Nome da nova fase' }),
      'Piso{Enter}',
    );

    expect(await within(nav).findByRole('button', { name: 'Fase 1 · Piso' })).toBeVisible();
    expect(within(nav).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Nome da nova fase' })).toHaveFocus();
  });
});
