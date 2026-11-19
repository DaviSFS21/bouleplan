'use client';

import { motion, useIsPresent } from 'motion/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useModalKeys } from '@/components/focus-trap/use-modal-keys';
import { useRegisterModal } from '@/components/modal-host/modal-host';
import { FADE, SLIDE_LEFT, preset } from '@/components/motion/tokens';
import styles from './drawer.module.css';

interface DrawerProps {
  label: string;
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({ label, opener, onClose, children }: Readonly<DrawerProps>) {
  const panel = useRef<HTMLDivElement | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    panel.current = element;
    setNode(element);
  }, []);
  const present = useIsPresent();
  useRegisterModal(present ? node : null);

  const restoreFocus = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    const previous = document.activeElement;
    // The opener is the button now rendered, which can be another element than the one clicked.
    const currentOpener = () => opener.current;
    panel.current?.focus();
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      const target = currentOpener() ?? previous;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
    restoreFocus.current = restore;
    return restore;
  }, [opener]);

  // An exit animation keeps the drawer mounted for a moment: focus must not wait for it.
  useEffect(() => {
    if (!present) restoreFocus.current();
  }, [present]);

  useModalKeys(node, { onEscape: onClose, trap: true });

  return (
    <>
      <motion.button
        type="button"
        className={styles.veil}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        {...preset(FADE)}
      />
      <motion.div
        ref={attach}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        inert={!present}
        className={styles.drawer}
        {...preset(SLIDE_LEFT)}
      >
        {children}
      </motion.div>
    </>
  );
}
