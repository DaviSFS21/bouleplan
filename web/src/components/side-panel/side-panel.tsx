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
  // "path" shows the eyebrow as plain meta text, for breadcrumbs with links.
  eyebrowStyle?: 'label' | 'path';
  actions?: ReactNode;
  footer?: ReactNode;
  opener?: RefObject<HTMLElement | null>;
  fallbackFocus?: () => HTMLElement | null;
  // Closing returns focus to the fallback first: the opener may be an older, unrelated element.
  preferFallback?: boolean;
  // Each new positive value moves focus into the panel, as the first open does.
  focusSignal?: number;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({
  label,
  eyebrow,
  eyebrowStyle = 'label',
  actions,
  footer,
  opener,
  fallbackFocus,
  preferFallback = false,
  focusSignal = 0,
  onClose,
  children,
}: Readonly<SidePanelProps>) {
  const panel = useRef<HTMLElement>(null);

  const fallback = useRef(fallbackFocus);
  const prefer = useRef(preferFallback);

  useEffect(() => {
    fallback.current = fallbackFocus;
    prefer.current = preferFallback;
  }, [fallbackFocus, preferFallback]);

  useEffect(() => {
    if (focusSignal > 0) panel.current?.focus();
  }, [focusSignal]);

  // Layout effects run before any child effect, so this still sees the opener, not a field a child focused.
  useLayoutEffect(() => {
    const previous = document.activeElement;
    const currentOpener = () => opener?.current ?? null;
    const openedFromRef = currentOpener() === previous;
    return () => {
      // The opener ref follows the header button now rendered, which can differ from the one clicked.
      const first = openedFromRef ? currentOpener() : previous;
      const candidates = prefer.current
        ? [fallback.current?.(), first]
        : [first, fallback.current?.()];
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
        <span className={eyebrowStyle === 'path' ? styles.path : styles.eyebrow}>{eyebrow}</span>
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
