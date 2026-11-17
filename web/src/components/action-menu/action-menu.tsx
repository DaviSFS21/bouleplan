'use client';

import { Check, Ellipsis } from 'lucide-react';
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

export interface ActionMenuRadio {
  label: string;
  checked: boolean;
  onSelect: () => void;
  // Styles the option as a chip, as the priority badges are.
  chipClassName?: string;
}

export interface ActionMenuGroup {
  group: string;
  items: readonly ActionMenuRadio[];
}

export type ActionMenuEntry = ActionMenuItem | ActionMenuGroup | { separator: true };

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
    return Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ??
        [],
    );
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

  function select(item: { onSelect: () => void }) {
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
            ) : 'group' in entry ? (
              <div key={`group-${entry.group}`} role="group" aria-label={entry.group}>
                <div className={styles.section} aria-hidden="true">
                  {entry.group}
                </div>
                <div
                  className={
                    entry.items.some((radio) => radio.chipClassName) ? styles.chips : undefined
                  }
                >
                  {entry.items.map((radio) => (
                    <button
                      key={radio.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={radio.checked}
                      tabIndex={-1}
                      className={
                        radio.chipClassName
                          ? [radio.chipClassName, styles.chip].join(' ')
                          : [styles.item, styles.radio].join(' ')
                      }
                      onClick={() => {
                        select(radio);
                      }}
                    >
                      {radio.chipClassName ? null : (
                        <span className={styles.check}>
                          {radio.checked ? (
                            <Icon icon={Check} size={14} aria-hidden="true" />
                          ) : null}
                        </span>
                      )}
                      {radio.label}
                    </button>
                  ))}
                </div>
              </div>
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
