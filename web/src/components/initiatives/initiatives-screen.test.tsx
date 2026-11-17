import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Initiative } from '@/api/types';
import { initiative, problemResponse } from '@/test/fixtures';
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

function serveInitiatives(items: Initiative[]) {
  server.use(
    http.get('*/api/initiatives', () => HttpResponse.json(items)),
    http.get('*/api/initiatives/:id/phases', () => HttpResponse.json([])),
  );
}

function renderScreen() {
  return renderWithQuery(<InitiativesScreen />);
}

async function findItem(name: string) {
  return within(await findIndex()).getByRole('button', { name: new RegExp(`^${name}`) });
}

function getItem(name: string) {
  return within(screen.getByRole('navigation', { name: 'Iniciativas' })).getByRole('button', {
    name: new RegExp(`^${name}`),
  });
}

async function findIndex() {
  return screen.findByRole('navigation', { name: 'Iniciativas' });
}

beforeEach(() => {
  navigateTo('/');
});

afterEach(() => {
  navigateTo('/');
});

describe('InitiativesScreen loading and errors', () => {
  it('shows the loading indicator while the list loads', async () => {
    serveInitiatives([reforma]);
    renderScreen();

    expect(screen.getByRole('status', { name: 'Carregando iniciativas' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Carregando' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    await findIndex();
    expect(screen.queryByRole('img', { name: 'Carregando' })).not.toBeInTheDocument();
  });

  it('shows an error and refetches on "Tentar de novo"', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    server.use(
      http.get('*/api/initiatives', () => new HttpResponse(null, { status: 503 }), { once: true }),
    );
    renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as iniciativas.');
    expect(screen.getByRole('main')).toContainElement(alert);
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await findItem('Reforma')).toBeInTheDocument();
  });

  it('shows the empty note and keeps "+ Nova iniciativa" when there are no initiatives', async () => {
    serveInitiatives([]);
    renderScreen();

    const index = await findIndex();
    expect(within(index).getByText('Nenhuma iniciativa ainda.')).toBeVisible();
    expect(within(index).getByRole('button', { name: '+ Nova iniciativa' })).toBeVisible();
    expect(within(index).getByRole('button', { name: 'Todas as tarefas' })).toBeVisible();
  });
});

describe('InitiativesScreen index', () => {
  it('lists "Todas as tarefas" first, then each initiative with color dot and meta', async () => {
    serveInitiatives([reforma, horta]);
    renderScreen();

    const index = await findIndex();
    const buttons = within(index).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Todas as tarefas',
      'Reformasem tarefas ainda',
      '',
      'Hortasem tarefas ainda',
      '',
      '+ Nova iniciativa',
    ]);
    expect(within(index).getAllByText('sem tarefas ainda')).toHaveLength(2);
    expect(within(index).queryByRole('progressbar')).not.toBeInTheDocument();

    const dot = buttons[1]?.querySelector<HTMLElement>('[style]');
    expect(dot?.style.getPropertyValue('--ini')).toBe('var(--ini-turquesa)');
    const hortaDot = buttons[3]?.querySelector<HTMLElement>('[style]');
    expect(hortaDot?.style.getPropertyValue('--ini')).toBe('var(--ini-verde)');
  });

  it('starts on "Todas as tarefas" with the empty board', async () => {
    serveInitiatives([reforma]);
    renderScreen();

    const index = await findIndex();
    expect(within(index).getByRole('button', { name: 'Todas as tarefas' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Todas as tarefas' })).toBeVisible();
    expect(screen.queryByText('Iniciativa', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma tarefa ainda.')).toBeVisible();
  });

  it('selects an initiative: updates the URL, aria-current and the board header', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma, horta]);
    renderScreen();

    await user.click(await findItem('Horta'));

    expect(window.location.search).toBe(`?iniciativa=${horta.id}`);
    expect(getItem('Horta')).toHaveAttribute('aria-current', 'true');
    expect(getItem('Reforma')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { level: 1, name: 'Horta' })).toBeVisible();
    expect(screen.getByText('Iniciativa', { selector: 'p' })).toBeVisible();
    expect(screen.getByText('Nenhuma tarefa ainda.')).toBeVisible();
  });

  it('goes back to "Todas as tarefas" by clearing the parameter', async () => {
    const user = userEvent.setup();
    navigateTo(`/?iniciativa=${horta.id}`);
    serveInitiatives([reforma, horta]);
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Todas as tarefas' }));

    expect(window.location.search).toBe('');
    expect(screen.getByRole('button', { name: 'Todas as tarefas' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('restores the selection from the URL on load', async () => {
    navigateTo(`/?iniciativa=${horta.id}`);
    serveInitiatives([reforma, horta]);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 1, name: 'Horta' })).toBeVisible();
    expect(getItem('Horta')).toHaveAttribute('aria-current', 'true');
  });

  it('falls back to "Todas as tarefas" when the URL names an unknown initiative', async () => {
    navigateTo('/?iniciativa=does-not-exist');
    serveInitiatives([reforma]);
    renderScreen();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Todas as tarefas' }),
    ).toBeVisible();
  });
});

describe('InitiativesScreen quick create', () => {
  async function openField(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: '+ Nova iniciativa' }));
    return screen.getByRole('textbox', { name: 'Nome da nova iniciativa' });
  }

  it('opens a focused field with placeholder and hint', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    const field = await openField(user);

    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('placeholder', 'Nome da iniciativa');
    expect(screen.getByText('Enter cria · Esc cancela')).toBeVisible();
    expect(screen.queryByRole('button', { name: '+ Nova iniciativa' })).not.toBeInTheDocument();
  });

  it('creates on Enter, selects the new initiative and closes the field', async () => {
    const user = userEvent.setup();
    const created = initiative({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Viagem',
      color: 'roxo',
    });
    const items = [reforma];
    let body: unknown;
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', async ({ request }) => {
        body = await request.json();
        items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    renderScreen();

    const field = await openField(user);
    await user.type(field, '  Viagem {Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    expect(body).toEqual({ name: 'Viagem' });
    expect(window.location.search).toBe(`?iniciativa=${created.id}`);
    expect(getItem('Viagem')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Viagem' })).toBeVisible();
    expect(screen.getByText('Nenhuma tarefa ainda.')).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Nova iniciativa' })).toBeVisible();
    expect(getItem('Viagem')).toHaveFocus();
  });

  it('makes the input read-only and busy, keeping focus, while the request is pending', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const created = initiative({ id: '44444444-4444-4444-8444-444444444444', name: 'Lenta' });
    const items = [reforma];
    server.use(
      http.get('*/api/initiatives', () => HttpResponse.json(items)),
      http.post('*/api/initiatives', async () => {
        await gate;
        items.push(created);
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    renderScreen();

    const field = await openField(user);
    await user.type(field, 'Lenta{Enter}');

    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveAttribute('aria-busy', 'true');
    expect(field).toHaveFocus();
    release();
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  it('cancels on Escape without creating anything', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    const field = await openField(user);
    await user.type(field, 'Rascunho{Escape}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nova iniciativa' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '+ Nova iniciativa' }));
    expect(screen.getByRole('textbox', { name: 'Nome da nova iniciativa' })).toHaveValue('');
  });

  it('closes when an empty field loses focus', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    await openField(user);
    await user.click(document.body);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('stays open when a field with text loses focus', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    const field = await openField(user);
    await user.type(field, 'Meio');
    await user.click(document.body);

    expect(screen.getByRole('textbox', { name: 'Nome da nova iniciativa' })).toHaveValue('Meio');
  });

  it('blocks a blank name client-side with the pt-BR message and no request', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    const posted = vi.fn();
    server.use(
      http.post('*/api/initiatives', () => {
        posted();
        return problemResponse('initiative.name.blank');
      }),
    );
    renderScreen();

    const field = await openField(user);
    await user.type(field, '   {Enter}');

    expect(within(await findIndex()).getByRole('alert')).toHaveTextContent(
      'Dê um nome à iniciativa.',
    );
    expect(posted).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
    expect(field).toHaveValue('   ');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(window.location.search).toBe('');

    await user.type(field, 'x');
    expect(within(await findIndex()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('limits the name to 200 characters', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    expect(await openField(user)).toHaveAttribute('maxlength', '200');
  });

  it('links the hint to the input, and the error too when there is one', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    renderScreen();

    const field = await openField(user);
    expect(field).toHaveAccessibleDescription('Enter cria · Esc cancela');

    await user.type(field, '{Enter}');
    expect(field).toHaveAccessibleDescription('Dê um nome à iniciativa. Enter cria · Esc cancela');
  });

  it.each([
    ['initiative.name.blank', 400, 'Dê um nome à iniciativa.'],
    ['initiative.name.too-long', 400, 'Use no máximo 200 caracteres.'],
    ['initiative.name.invalid-characters', 400, 'O nome tem caracteres inválidos.'],
    ['http.400', 400, 'Não foi possível criar a iniciativa. Tente de novo.'],
    ['internal', 500, 'Não foi possível criar a iniciativa. Tente de novo.'],
  ])(
    'shows the pt-BR message for server code %s, never the English detail, and keeps the text',
    async (code, status, message) => {
      const user = userEvent.setup();
      serveInitiatives([reforma]);
      server.use(
        http.post('*/api/initiatives', () =>
          problemResponse(code, status, 'English server detail'),
        ),
      );
      renderScreen();

      const field = await openField(user);
      await user.type(field, 'Algo{Enter}');

      const alert = within(await findIndex()).getByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(screen.queryByText(/English server detail/)).not.toBeInTheDocument();
      expect(field).not.toHaveAttribute('readonly');
      expect(field).toHaveFocus();
      expect(field).toHaveValue('Algo');
      expect(window.location.search).toBe('');
    },
  );

  it('shows the generic message when the failure is not a problem response', async () => {
    const user = userEvent.setup();
    serveInitiatives([reforma]);
    server.use(http.post('*/api/initiatives', () => new HttpResponse(null, { status: 502 })));
    renderScreen();

    const field = await openField(user);
    await user.type(field, 'Algo{Enter}');

    expect(within(await findIndex()).getByRole('alert')).toHaveTextContent(
      'Não foi possível criar a iniciativa. Tente de novo.',
    );
    expect(field).toHaveValue('Algo');
  });

  it('keeps the new initiative in the index when the refetch after the POST fails', async () => {
    const user = userEvent.setup();
    const created = initiative({ id: '55555555-5555-4555-8555-555555555555', name: 'Viagem' });
    let gets = 0;
    server.use(
      http.get('*/api/initiatives', () => {
        gets += 1;
        return gets === 1 ? HttpResponse.json([reforma]) : problemResponse('internal', 500);
      }),
      http.post('*/api/initiatives', () => HttpResponse.json(created, { status: 201 })),
    );
    renderScreen();

    const field = await openField(user);
    await user.type(field, 'Viagem{Enter}');

    expect(await findItem('Viagem')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Viagem' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
