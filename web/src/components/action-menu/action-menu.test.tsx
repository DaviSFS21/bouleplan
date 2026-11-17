import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu, type ActionMenuEntry } from './action-menu';

function setup(overrides: { onOpen?: () => void; onRename?: () => void } = {}) {
  const onOpen = overrides.onOpen ?? vi.fn();
  const onRename = overrides.onRename ?? vi.fn();
  const onDelete = vi.fn();
  const items: ActionMenuEntry[] = [
    { label: 'Abrir detalhes', onSelect: onOpen },
    { label: 'Editar nome', onSelect: onRename, shortcut: 'E' },
    { separator: true },
    { label: 'Excluir', onSelect: onDelete },
  ];
  const user = userEvent.setup();
  render(
    <>
      <ActionMenu label="Ações da iniciativa" items={items} />
      <button type="button">Fora</button>
    </>,
  );
  return {
    user,
    onOpen,
    onRename,
    onDelete,
    trigger: screen.getByRole('button', { name: 'Ações da iniciativa' }),
  };
}

describe('ActionMenu', () => {
  it('renders a closed trigger with menu semantics', () => {
    const { trigger } = setup();

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click, focuses the first item and lists items with shortcuts and separators', async () => {
    const { user, trigger } = setup();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Abrir detalhes',
      'Editar nomeE',
      'Excluir',
    ]);
    expect(items[0]).toHaveFocus();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('closes when the trigger is clicked again', async () => {
    const { user, trigger } = setup();

    await user.click(trigger);
    await user.click(trigger);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves with arrows, wrapping at both ends', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const [first, second, third] = screen.getAllByRole('menuitem');

    await user.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(third).toHaveFocus();
  });

  it('jumps with Home and End', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const items = screen.getAllByRole('menuitem');

    await user.keyboard('{End}');
    expect(items[2]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(items[0]).toHaveFocus();
  });

  it('selects with Enter, closes and returns focus to the trigger', async () => {
    const { user, trigger, onRename } = setup();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selects with Space', async () => {
    const { user, trigger, onOpen } = setup();
    await user.click(trigger);

    await user.keyboard(' ');

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('selects with a click and gives the action focus control', async () => {
    const { user, trigger, onDelete } = setup();
    await user.click(trigger);

    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape, returns focus and stops the event from reaching ancestors', async () => {
    const user = userEvent.setup();
    const onAncestorKeyDown = vi.fn();
    render(
      <div onKeyDown={onAncestorKeyDown}>
        <ActionMenu label="Ações" items={[{ label: 'Abrir', onSelect: vi.fn() }]} />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Ações' });
    await user.click(trigger);
    onAncestorKeyDown.mockClear();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onAncestorKeyDown).not.toHaveBeenCalled();
  });

  it('lets Escape through when the menu is closed', async () => {
    const user = userEvent.setup();
    const onAncestorKeyDown = vi.fn();
    render(
      <div onKeyDown={onAncestorKeyDown}>
        <ActionMenu label="Ações" items={[{ label: 'Abrir', onSelect: vi.fn() }]} />
      </div>,
    );
    screen.getByRole('button', { name: 'Ações' }).focus();

    await user.keyboard('{Escape}');

    expect(onAncestorKeyDown).toHaveBeenCalledTimes(1);
  });

  it('closes on Tab and moves focus on from the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.tab();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fora' })).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.click(screen.getByRole('button', { name: 'Fora' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the menu open on a click inside it', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.click(screen.getByRole('menu'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('ignores other keys', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.keyboard('a');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  });
});
