'use client';

import { X } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Icon } from '@/components/icon/icon';
import styles from './side-panel.module.css';

interface SidePanelProps {
  label: string;
  eyebrow: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  opener?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({
  label,
  eyebrow,
  actions,
  footer,
  opener,
  onClose,
  children,
}: Readonly<SidePanelProps>) {
  const panel = useRef<HTMLElement>(null);

  // Layout effects run before any child effect, so this still sees the opener, not a field a child focused.
  useLayoutEffect(() => {
    const previous = opener?.current ?? document.activeElement;
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }

  return (
    <aside
      ref={panel}
      aria-label={label}
      tabIndex={-1}
      className={styles.panel}
      onKeyDown={handleKeyDown}
    >
      <header className={styles.header}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <div className={styles.actions}>
          {actions}
          <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
            <Icon icon={X} />
          </button>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </aside>
  );
}
