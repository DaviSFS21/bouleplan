'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BLANK_EVENT_TITLE_MESSAGE } from '@/api/messages';
import type { CalendarEvent } from '@/api/types';
import { placeMenu } from '@/components/action-menu/place-menu';
import { InlineText } from '@/components/inline-text/inline-text';
import { formatRange, parseTime } from './planner-time';
import styles from './event-popover.module.css';

interface EventPopoverProps {
  event: CalendarEvent;
  anchor: HTMLElement;
  onClose: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export function EventPopover({
  event,
  anchor,
  onClose,
  onRename,
  onDelete,
}: Readonly<EventPopoverProps>) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const size = box.current?.getBoundingClientRect();
    if (!size) return;
    setPosition(
      placeMenu(anchor.getBoundingClientRect(), size, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [anchor]);

  useEffect(() => {
    const element = box.current;
    element?.focus();
    return () => {
      const lost = !document.activeElement || document.activeElement === document.body;
      if (anchor.isConnected && (lost || element?.contains(document.activeElement) === true)) {
        anchor.focus();
      }
    };
  }, [anchor]);

  useEffect(() => {
    function closeOnOutsidePointer(pointer: PointerEvent) {
      const target = pointer.target;
      if (!(target instanceof Node)) return;
      if (box.current?.contains(target) === true || anchor.contains(target)) return;
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
      aria-label="Compromisso"
      tabIndex={-1}
      className={styles.popover}
      style={position}
      onKeyDown={(keyboard) => {
        if (keyboard.key === 'Escape') {
          keyboard.stopPropagation();
          onClose();
        }
      }}
    >
      <InlineText
        label="Título do compromisso"
        variant="title"
        value={event.title}
        maxLength={300}
        trim
        validate={(text) => (text === '' ? BLANK_EVENT_TITLE_MESSAGE : null)}
        onCommit={onRename}
      />
      <p className={styles.meta}>
        {formatRange(parseTime(event.startTime), parseTime(event.endTime))}
      </p>
      <button type="button" className={styles.delete} onClick={onDelete}>
        Excluir
      </button>
    </div>,
    document.body,
  );
}
