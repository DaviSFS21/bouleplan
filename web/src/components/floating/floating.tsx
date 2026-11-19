'use client';

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
import { useModalTarget } from '@/components/modal-host/modal-host';
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

// A dialog next to its anchor: it follows scrolling, traps Tab, closes on Escape or a press
// outside, and gives focus back to the anchor.
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

  useEffect(() => {
    const element = box.current;
    initialFocus?.current?.focus();
    return () => {
      const target = anchor();
      const lost = !document.activeElement || document.activeElement === document.body;
      if (target && (lost || element?.contains(document.activeElement) === true)) target.focus();
    };
  }, [anchor, initialFocus]);

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
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      className={[styles.popover, className ?? ''].join(' ').trim()}
      style={position}
      onKeyDown={(keyboard) => {
        trapTab(keyboard, box.current);
        if (keyboard.key === 'Escape') {
          keyboard.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>,
    host ?? document.body,
  );
}
