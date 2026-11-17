'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { trapTab } from '@/components/focus-trap/trap-tab';
import styles from './drawer.module.css';

interface DrawerProps {
  label: string;
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({ label, opener, onClose, children }: Readonly<DrawerProps>) {
  const panel = useRef<HTMLDivElement>(null);

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
      <div className={styles.veil} aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
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
