'use client';

import { ChevronLeft, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { trapTab } from '@/components/focus-trap/trap-tab';
import { Icon } from '@/components/icon/icon';
import { useRegisterModal } from '@/components/modal-host/modal-host';
import { useIsPhone } from '@/components/responsive/use-media-query';
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
  const phone = useIsPhone();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLElement | null) => {
    panel.current = element;
    setNode(element);
  }, []);
  useRegisterModal(phone ? node : null);
  const wasPhone = useRef(phone);

  // The header swaps its buttons across the breakpoint, which would leave focus on nothing.
  useEffect(() => {
    if (wasPhone.current !== phone) panel.current?.focus();
    wasPhone.current = phone;
  }, [phone]);

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
    else if (phone) trapTab(event, panel.current);
  }

  const eyebrowText = (
    <span className={eyebrowStyle === 'path' ? styles.path : styles.eyebrow}>{eyebrow}</span>
  );

  return (
    <aside
      ref={attach}
      role={phone ? 'dialog' : undefined}
      aria-modal={phone ? true : undefined}
      aria-label={label}
      tabIndex={-1}
      className={styles.panel}
      onKeyDown={handleKeyDown}
    >
      <header className={styles.header}>
        {phone ? (
          <button type="button" className={styles.back} onClick={onClose}>
            <Icon icon={ChevronLeft} size={18} aria-hidden="true" />
            Voltar
          </button>
        ) : (
          eyebrowText
        )}
        <div className={styles.actions}>
          {actions}
          {phone ? null : (
            <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
              <Icon icon={X} />
            </button>
          )}
        </div>
      </header>
      {phone ? eyebrowText : null}
      <div className={styles.content}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </aside>
  );
}
