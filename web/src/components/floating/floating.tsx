'use client';

import { motion, useIsPresent } from 'motion/react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { placeMenu } from '@/components/action-menu/place-menu';
import { trapTab } from '@/components/focus-trap/trap-tab';
import { useRestoreFocus } from '@/components/focus-trap/use-restore-focus';
import { useModalTarget } from '@/components/modal-host/modal-host';
import { POP, preset } from '@/components/motion/tokens';
import styles from './floating.module.css';

interface FloatingProps {
  // Looked up each time, because the anchor can be drawn again while the popover is open.
  anchor: () => HTMLElement | null;
  label: string;
  onClose: () => void;
  // Where focus goes on open; the caller's content can also take it.
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

// A dialog next to its anchor, closed by Escape or a press outside.
export function Floating({
  anchor,
  label,
  onClose,
  initialFocus,
  className,
  children,
}: Readonly<FloatingProps>) {
  const box = useRef<HTMLDivElement>(null);
  const host = useModalTarget();
  const present = useIsPresent();
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    function reposition() {
      const element = anchor();
      const size = box.current?.getBoundingClientRect();
      if (!element || !size) return;
      setPosition(
        placeMenu(element.getBoundingClientRect(), size, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      );
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [anchor]);

  useRestoreFocus(
    present,
    () => [anchor()],
    () => box.current,
  );

  useEffect(() => {
    const element = box.current;
    const field = initialFocus?.current;
    // A child that took focus itself, such as a calendar grid, keeps it.
    if (!field && element?.contains(document.activeElement) === true) return;
    (field ?? element)?.focus();
  }, [initialFocus]);

  useEffect(() => {
    function closeOnOutsidePointer(pointer: PointerEvent) {
      const target = pointer.target;
      if (!(target instanceof Node)) return;
      if (box.current?.contains(target) === true || anchor()?.contains(target) === true) return;
      onClose();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [anchor, onClose]);

  return createPortal(
    <motion.div
      ref={box}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      inert={!present}
      className={[styles.popover, className ?? ''].join(' ').trim()}
      style={{ ...position, transformOrigin: 'top left' }}
      {...preset(POP)}
      onKeyDown={(keyboard) => {
        trapTab(keyboard, box.current);
        if (keyboard.key === 'Escape') {
          keyboard.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </motion.div>,
    host ?? document.body,
  );
}
