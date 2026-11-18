import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Initiative, Epic } from '@/api/types';
import { initiative, epic, problemResponse } from '@/test/fixtures';
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
const demolition = epic();
const flooring = epic({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Piso',
  createdAt: '2026-01-02T10:00:00-03:00',
});
const painting = epic({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Pintura',
  createdAt: '2026-01-03T10:00:00-03:00',
});
const seeds = epic({
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  initiativeId: horta.id,
  name: 'Sementes',
});

interface Backend {
  initiatives: Initiative[];
  epics: Epic[];
  calls: string[];
  bodies: unknown[];
}

function serve(initiatives: Initiative[], epics: Epic[]): Backend {
  const backend: Backend = { initiatives, epics: [...epics], calls: [], bodies: [] };
  const parked = new Map<string, Epic>();
  const find = (id: unknown) => backend.epics.find((item) => item.id === id);
  const park = (id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    const found = find(id);
    if (found) parked.set(found.id, found);
    backend.epics = backend.epics.filter((item) => item.id !== id);
    return found;
  };
  const unpark = (id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    const found = parked.get(String(id));
    if (found) backend.epics.push(found);
    return found;
  };
  server.use(
    http.get('*/api/initiatives', () => HttpResponse.json(backend.initiatives)),
    http.get('*/api/tasks', () => HttpResponse.json([])),
    http.post('*/api/initiatives/:id/archive', ({ params }) =>
      HttpResponse.json(backend.initiatives.find((item) => item.id === params.id)),
    ),
    http.post('*/api/initiatives/:id/unarchive', ({ params }) =>
      HttpResponse.json(backend.initiatives.find((item) => item.id === params.id)),
    ),
    http.delete('*/api/initiatives/:id', () => new HttpResponse(null, { status: 204 })),
    http.get('*/api/initiatives/:id/epics', ({ params }) =>
      HttpResponse.json(
        backend.epics
          .filter((item) => item.initiativeId === params.id)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      ),
    ),
    http.post('*/api/initiatives/:id/epics', async ({ request, params }) => {
      const body = (await request.json()) as { name: string };
      backend.bodies.push(body);
      const created = epic({
        id: `eeeeeeee-eeee-4eee-8eee-${String(backend.epics.length).padStart(12, '0')}`,
        initiativeId: String(params.id),
        name: body.name,
        createdAt: `2026-02-${String(10 + backend.epics.length)}T10:00:00-03:00`,
      });
      backend.epics.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch('*/api/epics/:id', async ({ request, params }) => {
      const body = (await request.json()) as { name: string };
      backend.bodies.push(body);
      const index = backend.epics.findIndex((item) => item.id === params.id);
      const updated = { ...backend.epics[index], ...body } as Epic;
      backend.epics[index] = updated;
      return HttpResponse.json(updated);
    }),
    http.post('*/api/epics/:id/archive', ({ params }) =>
      HttpResponse.json(park(params.id, 'archive')),
    ),
    http.post('*/api/epics/:id/unarchive', ({ params }) =>
      HttpResponse.json(unpark(params.id, 'unarchive')),
    ),
    http.delete('*/api/epics/:id', ({ params }) => {
      park(params.id, 'delete');
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/epics/:id/restore', ({ params }) =>
      HttpResponse.json(unpark(params.id, 'restore')),
    ),
  );
  return backend;
}

function index() {
  return screen.getByRole('navigation', { name: 'Iniciativas' });
}

function epicButton(label: string) {
  return within(index()).getByRole('button', { name: label });
}

async function openInitiative(user: ReturnType<typeof userEvent.setup>, name: string) {
  const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });
  await user.click(within(nav).getByRole('button', { name: new RegExp(`^${name}`) }));
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string, item: string) {
  await user.click(await within(index()).findByRole('button', { name: `Ações do épico ${name}` }));
  await user.click(screen.getByRole('menuitem', { name: item }));
}

beforeEach(() => {
  navigateTo('/');
});

afterEach(() => {
  navigateTo('/');
});

describe('epics in the index', () => {
  it('opens the epics of the selected initiative only, numbered in order', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition, flooring, seeds]);
    renderWithQuery(<InitiativesScreen />);

    await openInitiative(user, 'Reforma');

    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }),
    ).toBeVisible();
    expect(epicButton('Épico 2 · Piso')).toBeVisible();
    expect(within(index()).queryByText(/Sementes/)).not.toBeInTheDocument();

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Sementes' }),
    ).toBeVisible();
    expect(within(index()).queryByText(/Demolição/)).not.toBeInTheDocument();
  });

  it('shows no epics while "Todas as tarefas" is selected', async () => {
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);

    await screen.findByRole('navigation', { name: 'Iniciativas' });

    expect(within(index()).queryByText(/Demolição/)).not.toBeInTheDocument();
    expect(within(index()).queryByRole('button', { name: '+ Novo épico' })).not.toBeInTheDocument();
  });

  it('shows a note when the epics fail to load', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    server.use(http.get('*/api/initiatives/:id/epics', () => problemResponse('internal', 500)));
    renderWithQuery(<InitiativesScreen />);

    await openInitiative(user, 'Reforma');

    expect(await within(index()).findByText('Não foi possível carregar os épicos.')).toBeVisible();
    expect(within(index()).queryByRole('button', { name: '+ Novo épico' })).not.toBeInTheDocument();
  });

  it('filters by an epic, keeps "detalhes" and shows the path in the board header', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Épico 2 · Piso' });
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    expect(window.location.search).toContain('detalhes=1');

    await user.click(epicButton('Épico 2 · Piso'));

    expect(window.location.search).toBe(
      `?iniciativa=${reforma.id}&detalhes=1&epico=${flooring.id}`,
    );
    expect(epicButton('Épico 2 · Piso')).toHaveAttribute('aria-pressed', 'true');
    expect(epicButton('Épico 1 · Demolição')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    const overline = screen.getByRole('heading', { level: 1 }).previousElementSibling;
    expect(overline).toHaveTextContent('Reforma');
    expect(within(overline as HTMLElement).getByRole('button', { name: 'Reforma' })).toBeVisible();
  });

  it('opens the panel from the initiative name in the epic path', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    const main = screen.getByRole('main');
    await user.click(within(main).getByRole('button', { name: 'Reforma', expanded: false }));

    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
    expect(window.location.search).toContain(`epico=${demolition.id}`);
  });

  it('clears the filter when the epic is clicked again', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    await user.click(epicButton('Épico 1 · Demolição'));

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    expect(epicButton('Épico 1 · Demolição')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
  });

  it('restores the filter from the URL and ignores an unknown epic', async () => {
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}&epico=${demolition.id}`);
    const { unmount } = renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Demolição' })).toBeVisible();
    unmount();

    navigateTo(`/?iniciativa=${reforma.id}&epico=ffffffff-ffff-4fff-8fff-ffffffffffff`);
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();
    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('reads the old fase parameter and rewrites it to epico', async () => {
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}&fase=${demolition.id}`);
    renderWithQuery(<InitiativesScreen />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Demolição' })).toBeVisible();
    await waitFor(() => {
      expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${demolition.id}`);
    });
  });

  it('prefers epico over the old fase parameter', async () => {
    serve([reforma], [demolition, flooring]);
    navigateTo(`/?iniciativa=${reforma.id}&fase=${demolition.id}&epico=${flooring.id}`);
    renderWithQuery(<InitiativesScreen />);

    await waitFor(() => {
      expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${flooring.id}`);
    });
  });

  it('drops the epic filter when an initiative is selected', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));
    expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
  });

  it('drops the epic filter when opening another initiative panel from its menu', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Abrir detalhes' }));

    expect(window.location.search).toBe(`?iniciativa=${horta.id}&detalhes=1`);
  });
});

describe('creating epics in the index', () => {
  it('creates epics in order, keeps the field open and keeps the filter', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: '+ Novo épico' }));
    const field = within(index()).getByRole('textbox', { name: 'Nome do novo épico' });
    expect(field).toHaveAttribute('placeholder', 'Nome do épico');
    expect(field).toHaveAttribute('maxlength', '200');
    await user.type(field, '  Piso {Enter}');

    expect(await within(index()).findByRole('button', { name: 'Épico 2 · Piso' })).toBeVisible();
    expect(backend.bodies).toEqual([{ name: 'Piso' }]);
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${demolition.id}`);
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();

    await user.type(field, 'Pintura{Enter}');
    expect(await within(index()).findByRole('button', { name: 'Épico 3 · Pintura' })).toBeVisible();
  });

  it('blocks a blank name, cancels with Escape and closes when blurred empty', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: '+ Novo épico' }));
    const field = within(index()).getByRole('textbox', { name: 'Nome do novo épico' });

    await user.type(field, '   {Enter}');
    expect(await within(index()).findByRole('alert')).toHaveTextContent('Dê um nome ao épico.');
    expect(backend.bodies).toEqual([]);

    await user.type(field, 'Algo{Escape}');
    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(index()).getByRole('button', { name: '+ Novo épico' })).toHaveFocus();

    await user.click(within(index()).getByRole('button', { name: '+ Novo épico' }));
    await user.tab();
    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the server message and keeps the field on failure', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    server.use(
      http.post('*/api/initiatives/:id/epics', () =>
        problemResponse('epic.name.invalid-characters'),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: '+ Novo épico' }));

    await user.type(within(index()).getByRole('textbox'), 'Piso{Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'O nome tem caracteres inválidos.',
    );
    expect(within(index()).getByRole('textbox')).toHaveValue('Piso');
  });
});

describe('renaming an epic', () => {
  it('edits the name inline from the menu and returns focus to the row', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Piso', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome do épico' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, ' Contrapiso {Enter}');

    expect(
      await within(index()).findByRole('button', { name: 'Épico 2 · Contrapiso' }),
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
    await user.type(within(index()).getByRole('textbox', { name: 'Nome do épico' }), 'x{Escape}');

    expect(epicButton('Épico 1 · Demolição')).toHaveFocus();
    expect(backend.bodies).toEqual([]);
  });

  it('saves when focus leaves the field and does not steal focus', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    await user.type(within(index()).getByRole('textbox', { name: 'Nome do épico' }), '!');
    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));

    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Demolição!' }),
    ).not.toHaveFocus();
    expect(backend.bodies).toEqual([{ name: 'Demolição!' }]);
  });

  it('does not return focus to the row when Enter only confirms a composition', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome do épico' });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyUp(field, { key: 'Enter' });
    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));

    expect(epicButton('Épico 1 · Demolição')).not.toHaveFocus();
  });

  it('reports a blank name and keeps the old one', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    const field = within(index()).getByRole('textbox', { name: 'Nome do épico' });
    await user.clear(field);
    await user.type(field, '  {Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent('Dê um nome ao épico.');
    expect(epicButton('Épico 1 · Demolição')).toBeVisible();
    expect(backend.bodies).toEqual([]);
  });

  it('reports a server failure', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    server.use(http.patch('*/api/epics/:id', () => problemResponse('epic.name.too-long')));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', 'Editar nome');
    await user.type(within(index()).getByRole('textbox', { name: 'Nome do épico' }), 'x{Enter}');

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Use no máximo 200 caracteres.',
    );
  });
});

describe('archiving and deleting an epic', () => {
  it.each([
    ['Arquivar', 'Épico arquivado', 'archive', 'unarchive'],
    ['Excluir', 'Épico excluída', 'delete', 'restore'],
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
    expect(epicButton('Épico 1 · Piso')).toBeVisible();
    expect(backend.calls).toEqual([`${call} ${demolition.id}`]);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }),
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
    await screen.findByText('Épico arquivado');

    await user.keyboard('{Control>}z{/Control}');

    expect(
      await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }),
    ).toBeVisible();
  });

  it.each([
    ['Arquivar', 'Épico arquivado'],
    ['Excluir', 'Épico excluída'],
  ])('%s clears a filter on that epic and undo re-applies it', async (item, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 2 · Piso' }));
    expect(window.location.search).toContain(`epico=${flooring.id}`);

    await openMenu(user, 'Piso', item);
    await screen.findByText(message);

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Reforma' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${flooring.id}`);
  });

  it('keeps the filter on another epic and does not re-apply it on undo', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 2 · Piso' }));

    await openMenu(user, 'Demolição', 'Arquivar');
    await screen.findByText('Épico arquivado');
    expect(window.location.search).toContain(`epico=${flooring.id}`);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' });
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${flooring.id}`);
  });

  it('does not re-apply the filter when undo comes after leaving the initiative', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));
    await openMenu(user, 'Demolição', 'Arquivar');
    await screen.findByText('Épico arquivado');
    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
    });
  });

  it('moves focus to the neighbouring epic, else to the initiative item', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring, painting]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Piso', 'Arquivar');
    await waitFor(() => {
      expect(epicButton('Épico 2 · Pintura')).toHaveFocus();
    });

    await openMenu(user, 'Pintura', 'Arquivar');
    await waitFor(() => {
      expect(epicButton('Épico 1 · Demolição')).toHaveFocus();
    });

    await openMenu(user, 'Demolição', 'Excluir');
    await waitFor(() => {
      expect(within(index()).getByRole('button', { name: /^Reforma/ })).toHaveFocus();
    });
  });

  it.each([
    ['Arquivar', '*/api/epics/:id/archive', 'Não foi possível arquivar o épico. Tente de novo.'],
    ['Excluir', '*/api/epics/:id', 'Não foi possível excluir o épico. Tente de novo.'],
  ])('shows an alert when %s fails', async (item, path, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    const method = item === 'Excluir' ? http.delete : http.post;
    server.use(method(path, () => problemResponse('http.404', 404)));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');

    await openMenu(user, 'Demolição', item);

    expect(await within(index()).findByRole('alert')).toHaveTextContent(message);
    expect(epicButton('Épico 1 · Demolição')).toBeVisible();
    expect(screen.queryByText(/Épico (arquivada|excluída)/)).not.toBeInTheDocument();
  });

  it('shows an alert when undo fails', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    server.use(http.post('*/api/epics/:id/unarchive', () => problemResponse('http.404', 404)));
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await openMenu(user, 'Demolição', 'Arquivar');

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await within(index()).findByRole('alert')).toHaveTextContent(
      'Não foi possível desfazer. Tente de novo.',
    );
  });
});

describe('epics in the panel', () => {
  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' });
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    return screen.getByRole('complementary', { name: 'Iniciativa' });
  }

  it('lists the epics and filters the board when one is clicked', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    const panel = await openPanel(user);

    expect(within(panel).getByRole('heading', { level: 2, name: 'Épicos' })).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: 'Épico 2 · Piso' }));

    expect(window.location.search).toBe(
      `?iniciativa=${reforma.id}&detalhes=1&epico=${flooring.id}`,
    );
    expect(within(panel).getByRole('button', { name: 'Épico 2 · Piso' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  });

  it('says there are no epics yet', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await screen.findByRole('button', { name: 'Reforma', expanded: false }));

    const panel = screen.getByRole('complementary', { name: 'Iniciativa' });
    expect(await within(panel).findByText('Nenhum épico ainda.')).toBeVisible();
  });

  it('creates an epic and keeps the field open', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    const panel = await openPanel(user);

    await user.click(within(panel).getByRole('button', { name: '+ Novo épico' }));
    const field = within(panel).getByRole('textbox', { name: 'Nome do novo épico' });
    await user.type(field, 'Piso{Enter}');

    expect(await within(panel).findByRole('button', { name: 'Épico 2 · Piso' })).toBeVisible();
    expect(backend.bodies).toEqual([{ name: 'Piso' }]);
    expect(field).toHaveValue('');
    expect(window.location.search).not.toContain('epico=');
  });
});

describe('archiving or deleting an initiative with epics', () => {
  it.each([
    ['Arquivar', 'Iniciativa arquivada, com 2 épicos'],
    ['Excluir', 'Iniciativa excluída, com 2 épicos'],
  ])('%s counts the epics in the notice', async (item, message) => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Épico 2 · Piso' });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: item }));

    expect(await screen.findByText(message)).toBeVisible();
  });

  it('uses the singular for one epic', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada, com 1 épico')).toBeVisible();
  });

  it('keeps the plain notice without epics', async () => {
    const user = userEvent.setup();
    serve([reforma], []);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ Novo épico' })).toBeVisible();
    });

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada')).toBeVisible();
  });

  it('counts the epics even when they were never loaded', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(await screen.findByText('Iniciativa arquivada, com 1 épico')).toBeVisible();
  });

  it('keeps the plain notice when counting the epics fails', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    server.use(http.get('*/api/initiatives/:id/epics', () => problemResponse('internal', 500)));
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(await screen.findByText('Iniciativa excluída')).toBeVisible();
  });

  it('undo restores the selection together with the epic filter', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition, flooring]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 2 · Piso' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText('Iniciativa arquivada, com 2 épicos');
    expect(window.location.search).toBe('');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${flooring.id}`);
  });
});

describe('panel details', () => {
  async function openPanelFrom(user: ReturnType<typeof userEvent.setup>, opener: string) {
    const main = screen.getByRole('main');
    await user.click(within(main).getByRole('button', { name: opener, expanded: false }));
    return screen.getByRole('complementary', { name: 'Iniciativa' });
  }

  it('keeps the panel open when Escape cancels "+ Novo épico"', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    await user.click(await within(panel).findByRole('button', { name: '+ Novo épico' }));
    expect(within(panel).getByRole('textbox', { name: 'Nome do novo épico' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
    expect(
      within(panel).queryByRole('textbox', { name: 'Nome do novo épico' }),
    ).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: '+ Novo épico' })).toHaveFocus();
  });

  it('returns focus to the overline button after filtering from the panel and closing', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');

    await user.click(await within(panel).findByRole('button', { name: 'Épico 1 · Demolição' }));
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    const main = screen.getByRole('main');
    expect(within(main).getByRole('button', { name: 'Reforma' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Demolição' })).toBeVisible();
  });

  it('returns focus to the title button after clearing the filter and closing', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}&epico=${demolition.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Demolição' });
    await openPanelFrom(user, 'Reforma');

    await user.click(epicButton('Épico 1 · Demolição'));
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

  it('does not carry a typed epic name over to another initiative', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma, horta], [demolition, seeds]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    await user.click(await within(panel).findByRole('button', { name: '+ Novo épico' }));
    await user.type(within(panel).getByRole('textbox', { name: 'Nome do novo épico' }), 'Piso');

    await user.click(within(index()).getByRole('button', { name: /^Horta/ }));

    expect(await within(panel).findByRole('button', { name: 'Épico 1 · Sementes' })).toBeVisible();
    expect(
      within(panel).queryByRole('textbox', { name: 'Nome do novo épico' }),
    ).not.toBeInTheDocument();
    expect(backend.bodies).toEqual([]);
  });

  it('toggles the epic filter from the panel', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    navigateTo(`/?iniciativa=${reforma.id}`);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('heading', { level: 1, name: 'Reforma' });
    const panel = await openPanelFrom(user, 'Reforma');
    const button = await within(panel).findByRole('button', { name: 'Épico 1 · Demolição' });

    await user.click(button);
    expect(window.location.search).toContain('epico=');
    await user.click(button);

    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&detalhes=1`);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('"Novo épico" in the initiative menu', () => {
  it('selects the initiative, opens the field for it and focuses it', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma, horta], [demolition, seeds]);
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));

    const field = await within(nav).findByRole('textbox', { name: 'Nome do novo épico' });
    expect(field).toHaveFocus();
    expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
    await user.type(field, 'Colheita{Enter}');
    await within(nav).findByRole('button', { name: 'Épico 2 · Colheita' });
    expect(backend.epics.map((item) => item.initiativeId)).toEqual([
      reforma.id,
      horta.id,
      horta.id,
    ]);
  });

  it('keeps the epic filter when the initiative is already selected, and focuses the field again', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await user.click(await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' }));

    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));
    await within(index()).findByRole('textbox', { name: 'Nome do novo épico' });
    expect(window.location.search).toBe(`?iniciativa=${reforma.id}&epico=${demolition.id}`);

    await user.click(within(index()).getByRole('button', { name: /^Reforma/ }));
    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));

    expect(
      await within(index()).findByRole('textbox', { name: 'Nome do novo épico' }),
    ).toHaveFocus();
  });

  it('applies the intent once and does not leave it pending for later', async () => {
    const user = userEvent.setup();
    serve([reforma, horta], [seeds]);
    let broken = true;
    server.use(
      http.get('*/api/initiatives/:id/epics', ({ params }) =>
        broken && params.id === horta.id
          ? problemResponse('internal', 500)
          : HttpResponse.json(params.id === horta.id ? [seeds] : []),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });

    await user.click(within(nav).getByRole('button', { name: 'Ações de Horta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));
    await within(nav).findByText('Não foi possível carregar os épicos.');
    await user.click(within(nav).getByRole('button', { name: /^Reforma/ }));
    broken = false;
    await user.click(within(nav).getByRole('button', { name: /^Horta/ }));

    expect(await within(nav).findByRole('button', { name: 'Épico 1 · Sementes' })).toBeVisible();
    expect(within(nav).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not reopen the field after it was cancelled', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    renderWithQuery(<InitiativesScreen />);
    await openInitiative(user, 'Reforma');
    await within(index()).findByRole('button', { name: 'Épico 1 · Demolição' });
    await user.click(within(index()).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));
    await within(index()).findByRole('textbox', { name: 'Nome do novo épico' });

    await user.keyboard('{Escape}');
    await user.click(epicButton('Épico 1 · Demolição'));

    expect(within(index()).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('guards and stale intents', () => {
  it('sends one archive request when "Arquivar" is chosen twice during the count wait', async () => {
    const user = userEvent.setup();
    serve([reforma], [demolition]);
    let archives = 0;
    server.use(
      http.get('*/api/initiatives/:id/epics', async () => {
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

    expect(await screen.findByText('Iniciativa arquivada, com 1 épico')).toBeVisible();
    expect(archives).toBe(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not replay "Novo épico" after a failed epics load', async () => {
    const user = userEvent.setup();
    const backend = serve([reforma], []);
    let broken = true;
    server.use(
      http.get('*/api/initiatives/:id/epics', () =>
        broken ? problemResponse('internal', 500) : HttpResponse.json(backend.epics),
      ),
    );
    renderWithQuery(<InitiativesScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Iniciativas' });
    await user.click(within(nav).getByRole('button', { name: 'Ações de Reforma' }));
    await user.click(screen.getByRole('menuitem', { name: 'Novo épico' }));
    await within(nav).findByText('Não foi possível carregar os épicos.');
    broken = false;

    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    const panel = screen.getByRole('complementary', { name: 'Iniciativa' });
    await user.click(within(panel).getByRole('button', { name: '+ Novo épico' }));
    await user.type(
      within(panel).getByRole('textbox', { name: 'Nome do novo épico' }),
      'Piso{Enter}',
    );

    expect(await within(nav).findByRole('button', { name: 'Épico 1 · Piso' })).toBeVisible();
    expect(within(nav).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Nome do novo épico' })).toHaveFocus();
  });
});
