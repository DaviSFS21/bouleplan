'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { trapTab } from '@/components/focus-trap/trap-tab';
import { useRegisterModal } from '@/components/modal-host/modal-host';
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
  useRegisterModal(node);

  useLayoutEffect(() => {
    const previous = document.activeElement;
    // The opener is the button now rendered, which can be another element than the one clicked.
    const currentOpener = () => opener.current;
    panel.current?.focus();
    return () => {
      const target = currentOpener() ?? previous;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [opener]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
    else trapTab(event, panel.current);
  }

  return (
    <>
      <button
        type="button"
        className={styles.veil}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={attach}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={styles.drawer}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>
  );
}
