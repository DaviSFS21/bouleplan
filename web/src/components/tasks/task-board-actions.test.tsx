import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { serveTaskApi } from '@/test/task-backend';
import { card, column, reforma, titles, world } from '@/test/task-world';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo(`/?iniciativa=${reforma.id}`);
});

afterEach(() => {
  navigateTo('/');
});

async function renderBoard() {
  const backend = serveTaskApi(world);
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('article', { name: 'Comprar tinta' });
  return { backend, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

async function openMenu(user: User, title: string) {
  await user.click(screen.getByRole('button', { name: `Ações da tarefa ${title}` }));
}

async function choose(user: User, title: string, role: 'menuitem' | 'menuitemradio', item: string) {
  await openMenu(user, title);
  await user.click(screen.getByRole(role, { name: item }));
}

describe('renaming from the menu', () => {
  it('edits the title on the card, saves on Enter and returns focus to the card', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    const field = within(card('Lixar parede')).getByRole('textbox', { name: 'Título da tarefa' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Lixar o teto{Enter}');

    expect(await screen.findByRole('article', { name: 'Lixar o teto' })).toHaveFocus();
    expect(backend.bodies).toEqual([{ title: 'Lixar o teto' }]);
  });

  it('cancels with Esc, keeping the title and the focus on the card', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    await user.keyboard('xyz{Escape}');

    expect(card('Lixar parede')).toHaveFocus();
    expect(screen.queryByRole('textbox', { name: 'Título da tarefa' })).not.toBeInTheDocument();
    expect(backend.bodies).toEqual([]);
  });

  it('keeps Esc from reaching the page', async () => {
    const onKeyDown = vi.fn();
    document.addEventListener('keydown', onKeyDown);
    const { user } = await renderBoard();
    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    onKeyDown.mockClear();

    await user.keyboard('{Escape}');

    expect(onKeyDown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKeyDown);
  });

  it('tells a blank title apart from a rename and does not send it', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    await user.clear(screen.getByRole('textbox', { name: 'Título da tarefa' }));
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Dê um título à tarefa.')).toBeVisible();
    expect(backend.bodies).toEqual([]);
    expect(card('Lixar parede')).toBeVisible();
  });

  it('ignores Enter while an input method is composing', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    const field = screen.getByRole('textbox', { name: 'Título da tarefa' });

    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }),
    );

    expect(field).toBeVisible();
    expect(backend.bodies).toEqual([]);
  });

  it('rolls back a failed rename with the pt-BR message', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add('PATCH');

    await choose(user, 'Lixar parede', 'menuitem', 'Editar título');
    await user.type(screen.getByRole('textbox', { name: 'Título da tarefa' }), ' demais{Enter}');

    expect(
      await screen.findByText('Não foi possível salvar o título. Tente de novo.'),
    ).toBeVisible();
    expect(await screen.findByRole('article', { name: 'Lixar parede' })).toBeVisible();
  });
});

describe('priority', () => {
  it('marks the current priority and changes it at once', async () => {
    const { backend, user } = await renderBoard();
    await openMenu(user, 'Lixar parede');

    expect(screen.getByRole('menuitemradio', { name: 'P3' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'P1' })).not.toBeChecked();
    await user.click(screen.getByRole('menuitemradio', { name: 'P1' }));

    expect(await within(card('Lixar parede')).findByText('P1')).toBeVisible();
    expect(backend.bodies).toEqual([{ priority: 'P1' }]);
  });

  it('re-sorts the column when the priority changes', async () => {
    const { user } = await renderBoard();

    await choose(user, 'Pedir orçamento', 'menuitemradio', 'P1');

    await waitFor(() => {
      expect(titles('A fazer')).toEqual(['Comprar tinta', 'Pedir orçamento', 'Quebrar piso']);
    });
  });

  it('does nothing for the priority it already has', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitemradio', 'P3');

    expect(backend.bodies).toEqual([]);
  });

  it('rolls back a failed change and says so', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add('PATCH');

    await choose(user, 'Lixar parede', 'menuitemradio', 'P1');

    expect(
      await screen.findByText('Não foi possível mudar a prioridade. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(within(card('Lixar parede')).getByText('P3')).toBeVisible();
    });
  });
});

describe('moving by the menu', () => {
  it('moves the card, shows the toast and focuses the card in its new column', async () => {
    const { backend, user } = await renderBoard();

    await openMenu(user, 'Comprar tinta');
    expect(screen.getByRole('menuitemradio', { name: 'A fazer' })).toBeChecked();
    await user.click(screen.getByRole('menuitemradio', { name: 'Feito' }));

    expect(await screen.findByText('Tarefa movida para Feito')).toBeVisible();
    expect(titles('Feito')).toEqual(['Comprar tinta']);
    expect(backend.bodies).toEqual([{ status: 'done' }]);
    await waitFor(() => {
      expect(card('Comprar tinta')).toHaveFocus();
    });
    expect(screen.getByRole('heading', { level: 2, name: 'A fazer · 2' })).toBeVisible();
  });

  it('undoes with the toast button', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitemradio', 'Em andamento');

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(titles('A fazer')).toContain('Comprar tinta');
    });
    expect(backend.bodies).toEqual([{ status: 'in_progress' }, { status: 'to_do' }]);
  });

  it('undoes with Ctrl+Z', async () => {
    const { user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitemradio', 'Em andamento');
    await screen.findByText('Tarefa movida para Em andamento');

    await user.keyboard('{Control>}z{/Control}');

    await waitFor(() => {
      expect(titles('A fazer')).toContain('Comprar tinta');
    });
  });

  it('says the undo failed', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitemradio', 'Em andamento');
    await screen.findByText('Tarefa movida para Em andamento');
    backend.failing.add('PATCH');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });

  it('rolls the card back with the pt-BR message when the move fails', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add('PATCH');

    await choose(user, 'Comprar tinta', 'menuitemradio', 'Feito');

    expect(
      await screen.findByText('Não foi possível mover a tarefa. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(titles('A fazer')).toContain('Comprar tinta');
    });
    expect(titles('Feito')).toEqual([]);
    expect(screen.queryByText('Tarefa movida para Feito')).not.toBeInTheDocument();
  });

  it('does nothing when moving to the same state', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Comprar tinta', 'menuitemradio', 'A fazer');

    expect(backend.bodies).toEqual([]);
  });
});

describe('blocking', () => {
  it('blocks and unblocks without changing the column', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitem', 'Marcar como bloqueada');
    expect(await within(card('Lixar parede')).findByText('Bloqueada')).toBeVisible();
    expect(titles('Em andamento')).toEqual(['Lixar parede']);

    await choose(user, 'Lixar parede', 'menuitem', 'Desbloquear');
    await waitFor(() => {
      expect(within(card('Lixar parede')).queryByText('Bloqueada')).not.toBeInTheDocument();
    });
    expect(backend.bodies).toEqual([{ isBlocked: true }, { isBlocked: false }]);
  });

  it('says it could not update the block and rolls back', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add('PATCH');

    await choose(user, 'Lixar parede', 'menuitem', 'Marcar como bloqueada');

    expect(
      await screen.findByText('Não foi possível atualizar o bloqueio. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(within(card('Lixar parede')).queryByText('Bloqueada')).not.toBeInTheDocument();
    });
  });
});

describe.each([
  ['Arquivar', 'Tarefa arquivada', 'archive', 'unarchive'],
  ['Excluir', 'Tarefa excluída', 'delete', 'restore'],
])('%s', (item, message, call, undoCall) => {
  it('removes the card at once, shows the toast and focuses the next card', async () => {
    const { backend, user } = await renderBoard();

    await choose(user, 'Comprar tinta', 'menuitem', item);

    expect(await screen.findByText(message)).toBeVisible();
    expect(titles('A fazer')).toEqual(['Quebrar piso', 'Pedir orçamento']);
    expect(backend.calls).toContain(`${call} ${world.tasks[0]?.id ?? ''}`);
    await waitFor(() => {
      expect(card('Quebrar piso')).toHaveFocus();
    });
  });

  it('brings the card back with Desfazer', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitem', item);

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(titles('A fazer')).toEqual(['Comprar tinta', 'Quebrar piso', 'Pedir orçamento']);
    });
    expect(backend.calls).toContain(`${undoCall} ${world.tasks[0]?.id ?? ''}`);
    await waitFor(() => {
      expect(card('Comprar tinta')).toHaveFocus();
    });
  });

  it('puts the card back and says so when it fails', async () => {
    const { backend, user } = await renderBoard();
    backend.failing.add(item === 'Arquivar' ? 'POST' : 'DELETE');

    await choose(user, 'Comprar tinta', 'menuitem', item);

    expect(
      await screen.findByText(
        `Não foi possível ${item === 'Arquivar' ? 'arquivar' : 'excluir'} a tarefa. Tente de novo.`,
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(titles('A fazer')).toContain('Comprar tinta');
    });
  });

  it('sends the request once for a repeated click', async () => {
    const { backend, user } = await renderBoard();
    await openMenu(user, 'Comprar tinta');
    const entry = screen.getByRole('menuitem', { name: item });

    act(() => {
      entry.click();
      entry.click();
    });

    await screen.findByText(message);
    expect(backend.calls.filter((entryCall) => entryCall.startsWith(call))).toHaveLength(1);
  });

  it('says the undo failed', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitem', item);
    await screen.findByText(message);
    backend.failing.add('UNDO');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });
});

describe('focus after removing the only card', () => {
  it('goes to the "+ Nova tarefa" of the column', async () => {
    const { user } = await renderBoard();

    await choose(user, 'Lixar parede', 'menuitem', 'Arquivar');

    await waitFor(() => {
      expect(
        within(column('Em andamento')).getByRole('button', { name: '+ Nova tarefa' }),
      ).toHaveFocus();
    });
  });
});

describe('a slow answer', () => {
  it('does not take focus from a field the person moved on to', async () => {
    const { user } = await renderBoard();
    server.use(
      http.post('*/api/tasks/:id/archive', async () => {
        await delay(250);
        return HttpResponse.json(world.tasks[0]);
      }),
    );

    await choose(user, 'Comprar tinta', 'menuitem', 'Arquivar');
    await user.click(within(column('Feito')).getByRole('button', { name: '+ Nova tarefa' }));
    const field = within(column('Feito')).getByRole('textbox', { name: 'Título da nova tarefa' });
    await user.type(field, 'em curso');
    await screen.findByText('Tarefa arquivada');

    expect(field).toHaveFocus();
    expect(field).toHaveValue('em curso');
  });
});

describe('an undo after the board was remounted', () => {
  it('still tells that the undo failed', async () => {
    const { backend, user } = await renderBoard();
    await choose(user, 'Comprar tinta', 'menuitem', 'Arquivar');
    await screen.findByText('Tarefa arquivada');

    await user.click(screen.getByRole('button', { name: 'Todas as tarefas' }));
    backend.failing.add('UNDO');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Não foi possível desfazer. Tente de novo.')).toBeVisible();
  });
});
