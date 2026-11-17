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
  fallbackFocus?: () => HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({
  label,
  eyebrow,
  actions,
  footer,
  opener,
  fallbackFocus,
  onClose,
  children,
}: Readonly<SidePanelProps>) {
  const panel = useRef<HTMLElement>(null);

  const fallback = useRef(fallbackFocus);

  useEffect(() => {
    fallback.current = fallbackFocus;
  }, [fallbackFocus]);

  // Layout effects run before any child effect, so this still sees the opener, not a field a child focused.
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const currentOpener = () => opener?.current ?? null;
    const openedFromRef = currentOpener() === previous;
    return () => {
      // The opener ref follows the header button now rendered, which can differ from the one clicked.
      const candidates = [openedFromRef ? currentOpener() : previous, fallback.current?.()];
      const target = candidates.find(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.isConnected && element !== document.body,
      );
      target?.focus();
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
