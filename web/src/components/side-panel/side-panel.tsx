'use client';

import { ChevronLeft, X } from 'lucide-react';
import { motion, useIsPresent } from 'motion/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useRestoreFocus } from '@/components/focus-trap/use-restore-focus';
import { useModalKeys } from '@/components/focus-trap/use-modal-keys';
import { Icon } from '@/components/icon/icon';
import { useRegisterModal } from '@/components/modal-host/modal-host';
import { SLIDE_RIGHT, preset } from '@/components/motion/tokens';
import { useIsPhone } from '@/components/responsive/use-media-query';
import { SheetFrame } from '@/components/sheet/sheet-frame';
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
  const present = useIsPresent();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLElement | null) => {
    panel.current = element;
    setNode(element);
  }, []);
  useRegisterModal(phone && present ? node : null);
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

  // The opener ref follows the header button now rendered, which can differ from the one clicked.
  const openedFromRef = useRef(false);
  const opened = useRestoreFocus(present, (previous) => {
    const first = openedFromRef.current ? (opener?.current ?? null) : previous;
    return prefer.current ? [fallback.current?.(), first] : [first, fallback.current?.()];
  });
  useLayoutEffect(() => {
    openedFromRef.current = (opener?.current ?? null) === opened;
  }, [opener, opened]);

  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
  }, []);

  useModalKeys(node, { onEscape: onClose, trap: phone });

  const eyebrowText = (
    <span className={eyebrowStyle === 'path' ? styles.path : styles.eyebrow}>{eyebrow}</span>
  );

  const content = (
    <>
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
    </>
  );

  if (phone) {
    return (
      <SheetFrame label={label} onClose={onClose} onNode={attach}>
        <div className={styles.stack}>{content}</div>
      </SheetFrame>
    );
  }

  return (
    <motion.aside
      ref={attach}
      aria-label={label}
      tabIndex={-1}
      inert={!present}
      className={styles.panel}
      {...preset(SLIDE_RIGHT)}
    >
      {content}
    </motion.aside>
  );
}
