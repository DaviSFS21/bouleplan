'use client';

import { Ellipsis } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './action-menu.module.css';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  shortcut?: string;
}

export type ActionMenuEntry = ActionMenuItem | { separator: true };

interface ActionMenuProps {
  label: string;
  items: readonly ActionMenuEntry[];
}

export function ActionMenu({ label, items }: Readonly<ActionMenuProps>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function menuItems() {
    return Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  function move(step: (index: number, count: number) => number) {
    const elements = menuItems();
    const current = elements.indexOf(document.activeElement as HTMLElement);
    elements[step(current, elements.length)]?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (!open) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move((index, count) => (index + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move((index, count) => (index - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        move(() => 0);
        break;
      case 'End':
        event.preventDefault();
        move((_, count) => count - 1);
        break;
      case 'Escape':
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
        break;
      case 'Tab':
        trigger.current?.focus();
        setOpen(false);
        break;
    }
  }

  function select(item: ActionMenuItem) {
    setOpen(false);
    trigger.current?.focus();
    item.onSelect();
  }

  return (
    <div ref={root} className={styles.root} onKeyDown={handleKeyDown}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon icon={Ellipsis} />
      </button>
      {open ? (
        <div ref={menu} id={menuId} role="menu" aria-label={label} className={styles.menu}>
          {items.map((entry, index) =>
            'separator' in entry ? (
              <div
                key={`separator-${String(index)}`}
                role="separator"
                className={styles.separator}
              />
            ) : (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={styles.item}
                onClick={() => {
                  select(entry);
                }}
              >
                {entry.label}
                {entry.shortcut ? <span className={styles.shortcut}>{entry.shortcut}</span> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
