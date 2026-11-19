'use client';

import { motion, useIsPresent } from 'motion/react';
import { useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import { cancelEditing } from '@/components/focus-trap/cancel-editing';
import { FADE, SLIDE_UP, preset } from '@/components/motion/tokens';
import { useSheetDrag, type SheetDrag } from './use-sheet-drag';
import styles from './sheet.module.css';

interface SheetFrameProps {
  label: string;
  onClose: () => void;
  // Keep it stable: it runs again whenever it changes.
  onNode?: (element: HTMLDivElement | null) => void;
  children: ReactNode;
}

function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

// The strip a finger drags down to close the sheet; it never takes focus.
export function SheetHandle({ handlers }: Readonly<{ handlers: SheetDrag['handlers'] }>) {
  return (
    <div className={styles.handle} data-sheet-handle="" onMouseDown={keepFocus} {...handlers}>
      <span className={styles.grip} />
    </div>
  );
}

// Veil, drag handle and scrolling body of a phone sheet; focus and keys are the caller's.
export function SheetFrame({ label, onClose, onNode, children }: Readonly<SheetFrameProps>) {
  const present = useIsPresent();
  const sheet = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      root.current = element;
      onNode?.(element);
    },
    [onNode],
  );

  function dismiss() {
    cancelEditing(root.current);
    onClose();
  }

  const { y, handlers } = useSheetDrag(sheet, dismiss);

  return (
    <div
      ref={attach}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      inert={!present}
      className={styles.root}
    >
      <motion.button
        type="button"
        className={styles.veil}
        aria-hidden="true"
        tabIndex={-1}
        onMouseDown={keepFocus}
        onClick={dismiss}
        {...preset(FADE)}
      />
      <motion.div
        ref={sheet}
        className={styles.sheet}
        data-sheet=""
        style={{ y }}
        {...preset(SLIDE_UP)}
      >
        <SheetHandle handlers={handlers} />
        <div className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
