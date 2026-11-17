import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitiativesScreen } from '@/components/initiatives/initiatives-screen';
import { task } from '@/test/fixtures';
import { navigateTo } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { serveTaskApi } from '@/test/task-backend';
import {
  card,
  column,
  paint,
  piso,
  quote,
  reforma,
  sand,
  smash,
  titles,
  world,
} from '@/test/task-world';

vi.mock('next/navigation', () => import('@/test/next-navigation'));

beforeEach(() => {
  navigateTo(`/?iniciativa=${reforma.id}`);
});

afterEach(() => {
  navigateTo('/');
});

async function renderScreen(tasks = world.tasks) {
  const backend = serveTaskApi({ ...world, tasks });
  renderWithQuery(<InitiativesScreen />);
  await screen.findByRole('article', { name: 'Comprar tinta' });
  return { backend, user: userEvent.setup() };
}

function panel() {
  return screen.getByRole('complementary', { name: 'Tarefa' });
}

function params() {
  return new URLSearchParams(window.location.search);
}

function titleField() {
  return within(panel()).getByRole('textbox', { name: 'Título da tarefa' });
}

describe('opening the panel', () => {
  it('opens on a click on the card and writes the task to the URL', async () => {
    const { user } = await renderScreen();

    await user.click(card('Lixar parede'));

    expect(titleField()).toHaveValue('Lixar parede');
    expect(params().get('tarefa')).toBe(sand.id);
    expect(params().get('iniciativa')).toBe(reforma.id);
  });

  it('opens with Enter on the focused card, takes focus and gives it back on Esc', async () => {
    const { user } = await renderScreen();
    card('Lixar parede').focus();

    await user.keyboard('{Enter}');

    expect(titleField()).toBeVisible();
    await waitFor(() => {
      expect(panel()).toHaveFocus();
    });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(params().has('tarefa')).toBe(false);
    expect(card('Lixar parede')).toHaveFocus();
  });

  it('does not pick the card up with Enter, but still does with Space', async () => {
    const { user } = await renderScreen();
    card('Lixar parede').focus();

    await user.keyboard('{Enter}');
    expect(screen.queryByText(/está sobre a coluna/)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    card('Lixar parede').focus();
    await user.keyboard(' ');

    expect(
      await screen.findByText(/A tarefa Lixar parede está sobre a coluna/),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
  });

  it('opens from "Abrir", the first item of the card menu, which hints at Enter', async () => {
    const { user } = await renderScreen();

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Lixar parede' }));
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveAccessibleName('Abrir');
    expect(items[0]).toHaveAttribute('aria-keyshortcuts', 'Enter');
    expect(items[0]).toHaveTextContent('Enter');
    expect(items[1]).toHaveAccessibleName('Editar título');
    expect(items[1]).toHaveAttribute('aria-keyshortcuts', 'E');
    await user.click(screen.getByRole('menuitem', { name: 'Abrir' }));

    expect(titleField()).toHaveValue('Lixar parede');
    expect(params().get('tarefa')).toBe(sand.id);
  });

  it('starts the inline rename with E on the focused card, without opening the panel', async () => {
    const { user } = await renderScreen();
    card('Lixar parede').focus();

    await user.keyboard('e');

    expect(
      within(card('Lixar parede')).getByRole('textbox', { name: 'Título da tarefa' }),
    ).toHaveFocus();
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('ignores E with a modifier and keys typed inside the card menu', async () => {
    const { user } = await renderScreen();
    card('Lixar parede').focus();

    await user.keyboard('{Control>}e{/Control}');
    expect(within(card('Lixar parede')).queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Lixar parede' }));
    await user.keyboard('e');
    expect(within(card('Lixar parede')).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('ignores Enter while an input method is composing', async () => {
    await renderScreen();
    const target = card('Lixar parede');
    target.focus();

    act(() => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }),
      );
    });

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('closes when the open card is clicked again', async () => {
    const { user } = await renderScreen();
    await user.click(card('Lixar parede'));
    expect(panel()).toBeVisible();

    await user.click(card('Lixar parede'));

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(params().has('tarefa')).toBe(false);
  });

  it('does not open from the menu button, its items or the rename field', async () => {
    const { user } = await renderScreen();

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Lixar parede' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar título' }));
    await user.click(
      within(card('Lixar parede')).getByRole('textbox', { name: 'Título da tarefa' }),
    );

    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('switches to another task when its card is clicked, keeping the panel', async () => {
    const { user } = await renderScreen();
    await user.click(card('Lixar parede'));
    const before = panel();

    await user.click(card('Quebrar piso'));

    expect(panel()).toBe(before);
    expect(titleField()).toHaveValue('Quebrar piso');
    expect(params().get('tarefa')).toBe(smash.id);
  });

  it('outlines the open card and only that one', async () => {
    const { user } = await renderScreen();

    expect(card('Lixar parede')).not.toHaveAttribute('aria-current');
    await user.click(card('Lixar parede'));

    expect(card('Lixar parede')).toHaveAttribute('aria-current', 'true');
    expect(card('Lixar parede').className).toContain('open');
    expect(card('Quebrar piso')).not.toHaveAttribute('aria-current');
    expect(card('Quebrar piso').className).not.toContain('open');
  });

  it('shows what each task blocks and waits for on its card', async () => {
    await renderScreen([
      { ...paint, blocks: [sand.id, smash.id] },
      { ...sand, blockedBy: [paint.id] },
      { ...smash, blockedBy: [paint.id], blocks: [quote.id] },
      { ...quote, blockedBy: [smash.id] },
    ]);

    expect(within(card('Comprar tinta')).getByText('bloqueia 2')).toBeVisible();
    expect(within(card('Lixar parede')).getByText('esperando 1')).toBeVisible();
    expect(within(card('Quebrar piso')).getByText('bloqueia 1 · esperando 1')).toBeVisible();
  });

  it('shows no relation line for a task without blockers', async () => {
    await renderScreen();

    expect(within(card('Lixar parede')).queryByText(/bloqueia|esperando/)).not.toBeInTheDocument();
  });
});

describe('the URL', () => {
  it('opens a deep link to a task', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&tarefa=${smash.id}`);
    await renderScreen();

    expect(titleField()).toHaveValue('Quebrar piso');
    expect(card('Quebrar piso')).toHaveAttribute('aria-current', 'true');
  });

  it('opens a deep link without a selected initiative', async () => {
    navigateTo(`/?tarefa=${sand.id}`);
    await renderScreen();

    expect(titleField()).toHaveValue('Lixar parede');
  });

  it('drops an unknown task id and shows no panel', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&tarefa=00000000-0000-4000-8000-000000000000`);
    await renderScreen();

    await waitFor(() => {
      expect(params().has('tarefa')).toBe(false);
    });
    expect(params().get('iniciativa')).toBe(reforma.id);
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('drops the id of a task that is archived', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&tarefa=${smash.id}`);
    const backend = serveTaskApi({ ...world });
    backend.hiddenTasks.add(smash.id);
    renderWithQuery(<InitiativesScreen />);
    await screen.findByRole('article', { name: 'Comprar tinta' });

    await waitFor(() => {
      expect(params().has('tarefa')).toBe(false);
    });
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
  });

  it('drops the id of a task of an archived initiative', async () => {
    const hidden = task({ id: 'a1a1a1a1-0000-4000-8000-0000000000aa', initiativeId: 'x' });
    navigateTo(`/?tarefa=${hidden.id}`);
    await renderScreen([...world.tasks, hidden]);

    await waitFor(() => {
      expect(params().has('tarefa')).toBe(false);
    });
  });

  it('keeps the other params when it drops the task id', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&fase=${piso.id}&tarefa=nope`);
    await renderScreen();

    await waitFor(() => {
      expect(params().has('tarefa')).toBe(false);
    });
    expect(params().get('fase')).toBe(piso.id);
  });
});

describe('one panel at a time', () => {
  it('closes the initiative panel when a task opens', async () => {
    const { user } = await renderScreen();
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));
    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();

    await user.click(card('Lixar parede'));

    expect(screen.queryByRole('complementary', { name: 'Iniciativa' })).not.toBeInTheDocument();
    expect(panel()).toBeVisible();
    expect(params().has('detalhes')).toBe(false);
  });

  it('closes the task panel when the initiative panel opens', async () => {
    const { user } = await renderScreen();
    await user.click(card('Lixar parede'));

    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));

    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(params().has('tarefa')).toBe(false);
  });

  it('shows only the task panel for a link with both', async () => {
    navigateTo(`/?iniciativa=${reforma.id}&detalhes=1&tarefa=${sand.id}`);
    await renderScreen();

    expect(panel()).toBeVisible();
    expect(screen.queryByRole('complementary', { name: 'Iniciativa' })).not.toBeInTheDocument();
  });
});

describe('the path in the header', () => {
  it('selects the initiative from its link and keeps the task open', async () => {
    navigateTo(`/?tarefa=${sand.id}`);
    const { user } = await renderScreen();

    await user.click(within(panel()).getByRole('link', { name: 'Reforma' }));

    expect(params().get('iniciativa')).toBe(reforma.id);
    expect(params().get('tarefa')).toBe(sand.id);
    expect(titleField()).toHaveValue('Lixar parede');
  });

  it('filters the phase from its link and omits the phase for the implicit one', async () => {
    const { user } = await renderScreen();
    await user.click(card('Lixar parede'));
    expect(within(panel()).queryByText(/Fase \d/)).not.toBeInTheDocument();
    expect(within(panel()).getAllByRole('link')).toHaveLength(1);

    await user.click(card('Comprar tinta'));
    await user.click(await within(panel()).findByRole('link', { name: 'Fase 2 · Piso' }));

    expect(params().get('fase')).toBe(piso.id);
    expect(params().get('tarefa')).toBe(paint.id);
    expect(screen.getByRole('heading', { level: 1, name: 'Piso' })).toBeVisible();
  });

  it('leaves a modified click to the browser', async () => {
    const { user } = await renderScreen();
    await user.click(card('Lixar parede'));
    const link = within(panel()).getByRole('link', { name: 'Reforma' });
    expect(link).toHaveAttribute('href', `?iniciativa=${reforma.id}`);
    window.history.replaceState(null, '', `/?iniciativa=${reforma.id}&tarefa=${sand.id}`);

    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');

    expect(params().get('tarefa')).toBe(sand.id);
  });
});

describe('archiving and deleting the open task', () => {
  const cases = [
    { item: 'Arquivar', done: 'Tarefa arquivada' },
    { item: 'Excluir', done: 'Tarefa excluída' },
  ];

  it.each(cases)(
    'closes the panel on "$item" and moves focus to the neighbour card',
    async ({ item, done }) => {
      const { user } = await renderScreen();
      await user.click(card('Quebrar piso'));

      await user.click(within(panel()).getByRole('button', { name: 'Ações da tarefa' }));
      await user.click(screen.getByRole('menuitem', { name: item }));

      await screen.findByText(done);
      expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
      expect(params().has('tarefa')).toBe(false);
      expect(titles('A fazer')).toEqual(['Comprar tinta', 'Pedir orçamento']);
      await waitFor(() => {
        expect(card('Pedir orçamento')).toHaveFocus();
      });
    },
  );

  it.each(cases)(
    'reopens the panel on undo of "$item" when nothing else was opened',
    async ({ item, done }) => {
      const { user } = await renderScreen();
      await user.click(card('Quebrar piso'));
      await user.click(within(panel()).getByRole('button', { name: 'Ações da tarefa' }));
      await user.click(screen.getByRole('menuitem', { name: item }));
      await screen.findByText(done);

      await user.click(screen.getByRole('button', { name: 'Desfazer' }));

      expect(await screen.findByRole('complementary', { name: 'Tarefa' })).toBeVisible();
      expect(titleField()).toHaveValue('Quebrar piso');
      expect(params().get('tarefa')).toBe(smash.id);
    },
  );

  it.each(cases)(
    'does not reopen it on undo of "$item" after another task was opened',
    async ({ item, done }) => {
      const { user } = await renderScreen();
      await user.click(card('Quebrar piso'));
      await user.click(within(panel()).getByRole('button', { name: 'Ações da tarefa' }));
      await user.click(screen.getByRole('menuitem', { name: item }));
      await screen.findByText(done);
      await user.click(card('Lixar parede'));

      await user.click(screen.getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(titles('A fazer')).toContain('Quebrar piso');
      });
      expect(titleField()).toHaveValue('Lixar parede');
      expect(params().get('tarefa')).toBe(sand.id);
    },
  );

  it('does not reopen it on undo while the initiative panel is open', async () => {
    const { user } = await renderScreen();
    await user.click(card('Quebrar piso'));
    await user.click(within(panel()).getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText('Tarefa arquivada');
    await user.click(screen.getByRole('button', { name: 'Reforma', expanded: false }));

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => {
      expect(titles('A fazer')).toContain('Quebrar piso');
    });
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Iniciativa' })).toBeVisible();
  });

  it('keeps the panel when another task is archived', async () => {
    const { user } = await renderScreen();
    await user.click(card('Quebrar piso'));

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Lixar parede' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    await screen.findByText('Tarefa arquivada');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => {
      expect(card('Lixar parede')).toBeVisible();
    });

    expect(titleField()).toHaveValue('Quebrar piso');
    expect(params().get('tarefa')).toBe(smash.id);
  });

  it('keeps the panel open and says so when archiving fails', async () => {
    const { backend, user } = await renderScreen();
    await user.click(card('Quebrar piso'));
    backend.failing.add('POST');

    await user.click(within(panel()).getByRole('button', { name: 'Ações da tarefa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(
      await screen.findByText('Não foi possível arquivar a tarefa. Tente de novo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(titles('A fazer')).toContain('Quebrar piso');
    });
    expect(titleField()).toHaveValue('Quebrar piso');
    expect(params().get('tarefa')).toBe(smash.id);
  });

  it('closes the panel of the task that the card menu archives', async () => {
    const { user } = await renderScreen();
    await user.click(card('Quebrar piso'));

    await user.click(screen.getByRole('button', { name: 'Ações da tarefa Quebrar piso' }));
    await user.click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    await screen.findByText('Tarefa arquivada');
    expect(screen.queryByRole('complementary', { name: 'Tarefa' })).not.toBeInTheDocument();
    expect(column('A fazer')).toBeVisible();
  });
});
