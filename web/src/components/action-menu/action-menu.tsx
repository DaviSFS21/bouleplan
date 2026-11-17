'use client';

import { Check, Ellipsis } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/icon/icon';
import { placeMenu } from './place-menu';
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
  // Replaces the "⋯" icon button with a button of the caller's own look.
  trigger?: { className: string; children: ReactNode };
}

export function ActionMenu({ label, items, trigger: custom }: Readonly<ActionMenuProps>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function menuItems() {
    return Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ??
        [],
    );
  }

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = menu.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      setPosition(placeMenu(anchor, box, { width: window.innerWidth, height: window.innerHeight }));
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root.current?.contains(target) === true || menu.current?.contains(target) === true) {
        return;
      }
      setOpen(false);
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
        className={custom?.className ?? styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {custom?.children ?? <Icon icon={Ellipsis} />}
      </button>
      {open
        ? createPortal(
            <div
              ref={menu}
              id={menuId}
              role="menu"
              aria-label={label}
              className={styles.menu}
              style={position}
            >
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
                    aria-keyshortcuts={entry.shortcut}
                    onClick={() => {
                      select(entry);
                    }}
                  >
                    {entry.label}
                    {entry.shortcut ? (
                      <span className={styles.shortcut} aria-hidden="true">
                        {entry.shortcut}
                      </span>
                    ) : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
