'use client';

import { motion, useIsPresent } from 'motion/react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useRestoreFocus } from '@/components/focus-trap/use-restore-focus';
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

  // The opener is the button now rendered, which can be another element than the one clicked.
  useRestoreFocus(present, (previous) => [opener.current, previous]);
  useLayoutEffect(() => {
    panel.current?.focus();
  }, []);

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
