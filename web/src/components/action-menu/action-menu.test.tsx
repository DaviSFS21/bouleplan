import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PHONE, findVeil, setViewport } from '@/test/viewport';
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

describe('ActionMenu groups', () => {
  function setupGroups() {
    const onPriority = vi.fn<(priority: string) => void>();
    const onMove = vi.fn<(status: string) => void>();
    const user = userEvent.setup();
    render(
      <ActionMenu
        label="Ações da tarefa"
        items={[
          {
            group: 'Prioridade',
            items: [
              {
                label: 'P1',
                checked: false,
                onSelect: () => {
                  onPriority('P1');
                },
                chipClassName: 'chip',
              },
              {
                label: 'P2',
                checked: true,
                onSelect: () => {
                  onPriority('P2');
                },
                chipClassName: 'chip',
              },
            ],
          },
          { separator: true },
          {
            group: 'Mover para',
            items: [
              {
                label: 'A fazer',
                checked: true,
                onSelect: () => {
                  onMove('to_do');
                },
              },
              {
                label: 'Feito',
                checked: false,
                onSelect: () => {
                  onMove('done');
                },
              },
            ],
          },
        ]}
      />,
    );
    return {
      user,
      onPriority,
      onMove,
      trigger: screen.getByRole('button', { name: 'Ações da tarefa' }),
    };
  }

  it('lists labelled radio groups with their checked state', async () => {
    const { user, trigger } = setupGroups();

    await user.click(trigger);

    expect(screen.getByRole('group', { name: 'Prioridade' })).toBeVisible();
    expect(screen.getByRole('menuitemradio', { name: 'P2' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'P1' })).not.toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'A fazer' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Feito' })).not.toBeChecked();
  });

  it('walks radios with the arrow keys and selects one, closing and refocusing the trigger', async () => {
    const { user, trigger, onMove } = setupGroups();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Feito' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onMove).toHaveBeenCalledWith('done');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('selects a chip with a click', async () => {
    const { user, trigger, onPriority } = setupGroups();
    await user.click(trigger);

    await user.click(screen.getByRole('menuitemradio', { name: 'P1' }));

    expect(onPriority).toHaveBeenCalledWith('P1');
  });
});

describe('ActionMenu in a portal', () => {
  function boxes(triggerTop: number) {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.getAttribute('role') === 'menu') return new DOMRect(0, 0, 208, 200);
      if (this.getAttribute('aria-haspopup') === 'menu')
        return new DOMRect(400, triggerTop, 28, 28);
      return new DOMRect(0, 0, 0, 0);
    });
  }

  it('renders the menu under the body, fixed and anchored to the trigger', async () => {
    boxes(100);
    const { user, trigger } = setup();

    await user.click(trigger);

    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(trigger.parentElement?.contains(menu)).toBe(false);
    expect(menu).toHaveStyle({ top: '132px', left: '220px' });
    vi.restoreAllMocks();
  });

  it('flips above the trigger when the room below is short', async () => {
    boxes(window.innerHeight - 40);
    const { user, trigger } = setup();

    await user.click(trigger);

    expect(screen.getByRole('menu')).toHaveStyle({
      top: `${String(window.innerHeight - 40 - 4 - 200)}px`,
    });
    vi.restoreAllMocks();
  });

  it('follows the trigger on scroll', async () => {
    boxes(100);
    const { user, trigger } = setup();
    await user.click(trigger);
    boxes(300);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(screen.getByRole('menu')).toHaveStyle({ top: '332px' });
    vi.restoreAllMocks();
  });

  it('stays open for a pointer inside it and closes for one outside', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.pointer({ keys: '[MouseLeft>]', target: screen.getByRole('menu') });
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stops following the page after it closes', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    remove.mockRestore();
  });
});

describe('ActionMenu with its own trigger', () => {
  it('renders the given content and class on the trigger and still works as a menu', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionMenu
        label="Estado: A fazer"
        trigger={{ className: 'custom', children: <span>A fazer</span> }}
        items={[{ label: 'Feito', onSelect }]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Estado: A fazer' });
    expect(trigger).toHaveClass('custom');
    expect(trigger).toHaveTextContent('A fazer');
    expect(trigger.querySelector('svg')).toBeNull();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Feito' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });
});

describe('a disabled item', () => {
  it('cannot be chosen', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ActionMenu label="Ações" items={[{ label: 'Tirar da agenda', onSelect, disabled: true }]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Ações' }));
    await user.click(screen.getByRole('menuitem', { name: 'Tirar da agenda' }));

    expect(screen.getByRole('menuitem', { name: 'Tirar da agenda' })).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('ActionMenu as a bottom sheet on a phone', () => {
  it('rises as a sheet with a veil and no popover position', async () => {
    setViewport(PHONE);
    const { user, trigger } = setup();

    await user.click(trigger);

    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('sheet');
    expect(menu.style.top).toBe('');
    expect(findVeil()).toHaveAttribute('aria-hidden', 'true');
  });

  it('closes on a tap on the veil and returns focus to the trigger', async () => {
    setViewport(PHONE);
    const { user, trigger, onOpen } = setup();
    await user.click(trigger);

    await user.click(findVeil());

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('traps Tab inside the sheet, in both directions', async () => {
    setViewport(PHONE);
    const { user, trigger } = setup();
    await user.click(trigger);
    const items = screen.getAllByRole('menuitem');

    await user.tab({ shift: true });
    expect(items[2]).toHaveFocus();
    await user.tab();

    expect(items[0]).toHaveFocus();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('still selects an item, closes and returns focus', async () => {
    setViewport(PHONE);
    const { user, trigger, onRename } = setup();
    await user.click(trigger);

    await user.click(screen.getByRole('menuitem', { name: /Editar nome/ }));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not close on a pointer press outside while it is a sheet', async () => {
    setViewport(PHONE);
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Fora' }),
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes when the screen turns across the phone breakpoint', async () => {
    setViewport(PHONE);
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    setViewport({ width: 1440, coarse: false });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the veil out of the tab order and out of the accessibility tree', async () => {
    setViewport(PHONE);
    const { user, trigger } = setup();
    await user.click(trigger);

    expect(findVeil()).toHaveAttribute('tabindex', '-1');
    expect(findVeil()).toHaveAttribute('aria-hidden', 'true');
  });
});
