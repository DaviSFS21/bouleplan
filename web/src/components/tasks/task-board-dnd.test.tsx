import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import { card, column, reforma, titles, world } from '@/test/task-world';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

const COLUMN_LEFT: Record<string, number> = { to_do: 0, in_progress: 320, done: 640 };

// jsdom has no layout: columns sit side by side and cards inside their column.
function layOut() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const own = this.getAttribute('data-column');
    const owner = this.closest('[data-column]')?.getAttribute('data-column');
    const status = own ?? owner;
    if (status === null || status === undefined) return new DOMRect(0, 0, 0, 0);
    const left = COLUMN_LEFT[status] ?? 0;
    return own ? new DOMRect(left, 0, 300, 600) : new DOMRect(left + 16, 50, 268, 90);
  });
}

beforeEach(() => {
  layOut();
  navigateTo(`/?iniciativa=${reforma.id}`);
});

afterEach(() => {
  vi.restoreAllMocks();
  navigateTo('/');
});

async function renderBoard() {
  const backend = serveTaskApi(world);
  renderWithQuery(<InitiativesScreen />);
  const first = await screen.findByRole('article', { name: 'Comprar tinta' });
  return { backend, user: userEvent.setup(), first };
}

async function pickUp(user: ReturnType<typeof userEvent.setup>, title: string) {
  card(title).focus();
  await user.keyboard(' ');
  await screen.findByText(`A tarefa ${title} está sobre a coluna A fazer.`);
}

function slot(name: string) {
  return column(name).querySelector('li[aria-hidden="true"]');
}

describe('keyboard drag and drop', () => {
  it('describes how to move a card for screen readers', async () => {
    const { first } = await renderBoard();

    const instructions = document.getElementById(
      first.getAttribute('aria-describedby') ?? 'missing',
    );

    expect(instructions).toHaveTextContent(
      /Para pegar a tarefa, pressione Espaço\. .*Enter abre a tarefa\./,
    );
    expect(first).toHaveAttribute('aria-roledescription', 'tarefa arrastável');
  });

  it('picks up, moves to another column with the arrows and drops to change the state', async () => {
    const { backend, user } = await renderBoard();
    await pickUp(user, 'Comprar tinta');

    await user.keyboard('{ArrowRight}');
    expect(
      await screen.findByText('A tarefa Comprar tinta está sobre a coluna Em andamento.'),
    ).toBeInTheDocument();
    expect(slot('Em andamento')).toBeInTheDocument();
    expect(slot('A fazer')).not.toBeInTheDocument();

    await user.keyboard(' ');

    expect(
      await screen.findByText('A tarefa Comprar tinta foi solta na coluna Em andamento.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(titles('Em andamento')).toEqual(['Comprar tinta', 'Lixar parede']);
    });
    expect(backend.bodies).toEqual([{ status: 'in_progress' }]);
    expect(await screen.findByText('Tarefa movida para Em andamento')).toBeVisible();
    expect(slot('Em andamento')).not.toBeInTheDocument();
  });

  it('shows the slot where the card lands by the sort order', async () => {
    const { user } = await renderBoard();
    await pickUp(user, 'Pedir orçamento');

    await user.keyboard('{ArrowRight}');

    await screen.findByText('A tarefa Pedir orçamento está sobre a coluna Em andamento.');
    const entries = Array.from(column('Em andamento').querySelectorAll('li'));
    expect(entries.map((entry) => entry.getAttribute('aria-hidden'))).toEqual(['true', null]);
    await user.keyboard('{Escape}');
  });

  it('goes two columns right and one back left', async () => {
    const { backend, user } = await renderBoard();
    await pickUp(user, 'Comprar tinta');

    await user.keyboard('{ArrowRight}');
    await screen.findByText(/sobre a coluna Em andamento/);
    await user.keyboard('{ArrowRight}');
    await screen.findByText(/sobre a coluna Feito/);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    await screen.findByText(/sobre a coluna Em andamento/);
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');

    await waitFor(() => {
      expect(titles('Feito')).toEqual(
        ['Comprar tinta', 'Plantar alface'].filter((t) => t === 'Comprar tinta'),
      );
    });
    expect(backend.bodies).toEqual([{ status: 'done' }]);
  });

  it('ignores the up and down arrows', async () => {
    const { backend, user } = await renderBoard();
    await pickUp(user, 'Comprar tinta');

    await user.keyboard('{ArrowDown}{ArrowUp}');
    await user.keyboard(' ');

    await screen.findByText('A tarefa Comprar tinta foi solta na coluna A fazer.');
    expect(backend.bodies).toEqual([]);
  });

  it('does nothing when dropped on the same column', async () => {
    const { backend, user } = await renderBoard();
    await pickUp(user, 'Comprar tinta');

    await user.keyboard('{ArrowRight}{ArrowLeft}');
    await screen.findByText(/sobre a coluna A fazer/);
    await user.keyboard(' ');

    await screen.findByText('A tarefa Comprar tinta foi solta na coluna A fazer.');
    expect(backend.bodies).toEqual([]);
    expect(titles('A fazer')).toContain('Comprar tinta');
    expect(slot('A fazer')).not.toBeInTheDocument();
  });

  it('cancels with Esc and announces it', async () => {
    const { backend, user } = await renderBoard();
    await pickUp(user, 'Comprar tinta');
    await user.keyboard('{ArrowRight}');
    await screen.findByText(/sobre a coluna Em andamento/);

    await user.keyboard('{Escape}');

    expect(
      await screen.findByText(
        'Movimento cancelado. A tarefa Comprar tinta continua na coluna A fazer.',
      ),
    ).toBeInTheDocument();
    expect(backend.bodies).toEqual([]);
    expect(slot('Em andamento')).not.toBeInTheDocument();
  });

  it('rolls the card back with the pt-BR message when the drop fails', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add('PATCH');
    await pickUp(user, 'Comprar tinta');

    await user.keyboard('{ArrowRight}');
    await screen.findByText(/sobre a coluna Em andamento/);
    await user.keyboard(' ');

    expect(
      await screen.findByText('Não foi possível mover a tarefa. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(titles('A fazer')).toContain('Comprar tinta');
    });
  });

  it('does not start a drag from the menu button', async () => {
    const { user } = await renderBoard();
    const trigger = screen.getByRole('button', { name: 'Ações da tarefa Comprar tinta' });
    trigger.focus();

    await user.keyboard(' ');

    expect(screen.queryByText(/Você pegou a tarefa/)).not.toBeInTheDocument();
  });

  it('cannot drag a card while its title is being edited', async () => {
    const { user } = await renderBoard();
    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Comprar tinta' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar título' }));

    await user.keyboard(' ');

    expect(screen.queryByText(/Você pegou a tarefa/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Título da tarefa' })).toHaveValue(' ');
  });
});

describe('pointer drag and drop', () => {
  function drag(title: string, toX: number) {
    const source = card(title);
    fireEvent.pointerDown(source, { isPrimary: true, button: 0, clientX: 40, clientY: 80 });
    fireEvent.pointerMove(document, { isPrimary: true, clientX: 40 + 10, clientY: 80 });
    fireEvent.pointerMove(document, { isPrimary: true, clientX: toX, clientY: 90 });
  }

  it('drops on another column to change the state', async () => {
    const { backend } = await renderBoard();

    drag('Comprar tinta', 700);
    await screen.findByText(/sobre a coluna Feito/);
    fireEvent.pointerUp(document, { isPrimary: true, clientX: 700, clientY: 90 });

    await waitFor(() => {
      expect(titles('Feito')).toEqual(['Comprar tinta']);
    });
    expect(backend.bodies).toEqual([{ status: 'done' }]);
  });

  it('does not start a drag for a small movement, which stays a click', async () => {
    await renderBoard();

    fireEvent.pointerDown(card('Comprar tinta'), {
      isPrimary: true,
      button: 0,
      clientX: 40,
      clientY: 80,
    });
    fireEvent.pointerMove(document, { isPrimary: true, clientX: 43, clientY: 80 });
    fireEvent.pointerUp(document, { isPrimary: true, clientX: 43, clientY: 80 });

    expect(screen.queryByText(/está sobre a coluna/)).not.toBeInTheDocument();
  });

  it('cancels when released outside every column', async () => {
    const { backend } = await renderBoard();

    drag('Comprar tinta', 1500);
    await screen.findByText(/fora das colunas/);
    fireEvent.pointerUp(document, { isPrimary: true, clientX: 1500, clientY: 90 });

    await screen.findByText(/solta fora das colunas/);
    expect(backend.bodies).toEqual([]);
  });
});
