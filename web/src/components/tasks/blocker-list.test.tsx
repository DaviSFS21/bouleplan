import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/problem';
import { task } from '@/test/fixtures';
import { BlockerList } from './blocker-list';
import { fireEvent } from '@testing-library/react';

const self = task({ id: 'self', title: 'Esta tarefa' });
const painting = task({ id: 'p', title: 'Pintar sala' });
const sanding = task({ id: 's', title: 'Lixar parede' });
const budget = task({ id: 'b', title: 'Pedir orçamento' });
const all = [self, painting, sanding, budget];

function problem(code: string) {
  return new ApiError({ type: 't', title: 't', status: 422, detail: 'd', code });
}

function setup(overrides: { onAdd?: () => Promise<void>; onRemove?: () => Promise<void> } = {}) {
  const props = {
    onOpen: vi.fn(),
    onAdd: vi.fn(overrides.onAdd ?? (() => Promise.resolve())),
    onRemove: vi.fn(overrides.onRemove ?? (() => Promise.resolve())),
  };
  render(
    <BlockerList
      label="Bloqueia"
      addLabel="Buscar tarefa"
      ids={['s', 'gone']}
      tasks={all}
      selfId="self"
      hintOf={() => 'Reforma'}
      {...props}
    />,
  );
  return { ...props, user: userEvent.setup() };
}

async function openCombobox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '+ Adicionar' }));
  return screen.getByRole('combobox', { name: 'Buscar tarefa' });
}

describe('BlockerList', () => {
  it('lists the known tasks, skips ids it does not know and opens one', async () => {
    const { user, onOpen } = setup();

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Lixar parede' }));

    expect(onOpen).toHaveBeenCalledWith('s');
  });

  it('removes with the ×', async () => {
    const { user, onRemove } = setup();

    await user.click(screen.getByRole('button', { name: 'Remover Lixar parede' }));

    expect(onRemove).toHaveBeenCalledWith('s');
  });

  it('offers neither itself nor the tasks already listed', async () => {
    const { user } = setup();

    await openCombobox(user);

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Pintar salaReforma',
      'Pedir orçamentoReforma',
    ]);
  });

  it('filters by title ignoring case and accents and says when nothing matches', async () => {
    const { user } = setup();
    const input = await openCombobox(user);

    await user.type(input, 'ORCAMENTO');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.clear(input);
    await user.type(input, 'zzz');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma tarefa encontrada.')).toBeVisible();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(screen.getByRole('combobox')).toBeVisible();
  });

  it('moves the active option with the arrows, wrapping, and adds it with Enter', async () => {
    const { user, onAdd } = setup();
    const input = await openCombobox(user);
    const [first, second] = screen.getAllByRole('option');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', first?.id);

    await user.keyboard('{ArrowDown}');
    expect(second).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Enter}');

    expect(onAdd).toHaveBeenCalledExactlyOnceWith('b');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Adicionar' })).toHaveFocus();
  });

  it('adds with a click without losing focus first', async () => {
    const { user, onAdd } = setup();
    await openCombobox(user);

    await user.click(screen.getByRole('option', { name: /Pintar sala/ }));

    expect(onAdd).toHaveBeenCalledExactlyOnceWith('p');
  });

  it('closes with Esc, back to the button, without reaching the panel', async () => {
    const onKey = vi.fn();
    document.addEventListener('keydown', onKey);
    const { user } = setup();
    await openCombobox(user);
    onKey.mockClear();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Adicionar' })).toHaveFocus();
    expect(onKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKey);
  });

  it('closes on blur without taking focus back', async () => {
    const { user } = setup();
    await openCombobox(user);

    await user.tab();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Adicionar' })).not.toHaveFocus();
  });

  it('ignores Enter while an input method is composing', async () => {
    const { user, onAdd } = setup();
    const input = await openCombobox(user);

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(onAdd).not.toHaveBeenCalled();
    expect(input).toBeVisible();
  });

  it.each([
    ['task.blocker.cycle', 'Isso criaria um ciclo: a outra tarefa já depende desta.'],
    ['task.blocker.self', 'Uma tarefa não pode bloquear a si mesma.'],
  ])('shows the message for %s and clears it on the next try', async (code, message) => {
    let fail = true;
    const { user } = setup({
      onAdd: () => (fail ? Promise.reject(problem(code)) : Promise.resolve()),
    });
    await openCombobox(user);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);

    fail = false;
    await openCombobox(user);
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a generic message when removing fails', async () => {
    const { user } = setup({ onRemove: () => Promise.reject(new Error('boom')) });

    await user.click(screen.getByRole('button', { name: 'Remover Lixar parede' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível remover o bloqueio. Tente de novo.',
    );
  });

  it('lets two different removals run at once', async () => {
    const pending: (() => void)[] = [];
    const onRemove = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );
    const user = userEvent.setup();
    render(
      <BlockerList
        label="Bloqueia"
        addLabel="x"
        ids={['p', 's']}
        tasks={all}
        selfId="self"
        hintOf={() => ''}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remover Pintar sala' }));
    await user.click(screen.getByRole('button', { name: 'Remover Lixar parede' }));

    expect(onRemove).toHaveBeenCalledTimes(2);
    pending.forEach((release) => {
      release();
    });
  });

  it('offers neither tasks of the excluded list', async () => {
    render(
      <BlockerList
        label="Bloqueia"
        addLabel="x"
        ids={[]}
        exclude={['p']}
        tasks={all}
        selfId="self"
        hintOf={() => ''}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar' }));

    expect(screen.queryByRole('option', { name: /Pintar sala/ })).not.toBeInTheDocument();
  });

  it('announces when nothing matches', async () => {
    const { user } = setup();
    const input = await openCombobox(user);

    await user.type(input, 'zzz');

    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma tarefa encontrada.');
  });

  it('scrolls the active option into view', async () => {
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    const { user } = setup();
    await openCombobox(user);

    await user.keyboard('{ArrowDown}');

    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    Reflect.deleteProperty(window.HTMLElement.prototype, 'scrollIntoView');
  });

  it('sends one request for a repeated click', async () => {
    let release: () => void = () => undefined;
    const { user, onRemove } = setup({
      onRemove: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    const remove = screen.getByRole('button', { name: 'Remover Lixar parede' });

    await user.click(remove);
    await user.click(remove);
    release();

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(
      within(screen.getByRole('group', { name: 'Bloqueia' })).getByText('Lixar parede'),
    ).toBeVisible();
  });

  it('shows only the button when the list is empty', () => {
    render(
      <BlockerList
        label="Bloqueada por"
        addLabel="x"
        ids={[]}
        tasks={all}
        selfId="self"
        hintOf={() => ''}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows at most eight options', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      task({ id: `t${String(index)}`, title: `Tarefa ${String(index)}` }),
    );
    render(
      <BlockerList
        label="Bloqueia"
        addLabel="Buscar"
        ids={[]}
        tasks={many}
        selfId="self"
        hintOf={() => ''}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar' }));

    expect(screen.getAllByRole('option')).toHaveLength(8);
  });
});
