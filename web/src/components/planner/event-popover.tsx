'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BLANK_EVENT_TITLE_MESSAGE } from '@/api/messages';
import { isPending } from '@/api/planner';
import type { CalendarEvent } from '@/api/types';
import { placeMenu } from '@/components/action-menu/place-menu';
import { InlineText } from '@/components/inline-text/inline-text';
import { formatRange, parseTime } from './planner-time';
import styles from './event-popover.module.css';

interface EventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

function anchorOf(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-event-id="${id}"]`);
}

export function EventPopover({ event, onClose, onRename, onDelete }: Readonly<EventPopoverProps>) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const pending = isPending(event.id);
  const eventId = event.id;
  const lastAnchor = useRef<HTMLElement | null>(null);

  // The block is rendered again when the server gives the event its id, so it is looked up each time.
  useLayoutEffect(() => {
    function reposition() {
      const anchor = anchorOf(eventId);
      const size = box.current?.getBoundingClientRect();
      if (!anchor || !size) return;
      lastAnchor.current = anchor;
      setPosition(
        placeMenu(anchor.getBoundingClientRect(), size, {
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
  }, [eventId]);

  useEffect(() => {
    const element = box.current;
    element?.focus();
    return () => {
      const anchor = lastAnchor.current;
      const lost = !document.activeElement || document.activeElement === document.body;
      if (anchor?.isConnected && (lost || element?.contains(document.activeElement) === true)) {
        anchor.focus();
      }
    };
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(pointer: PointerEvent) {
      const target = pointer.target;
      if (!(target instanceof Node)) return;
      if (box.current?.contains(target) === true || anchorOf(eventId)?.contains(target) === true) {
        return;
      }
      onClose();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [eventId, onClose]);

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
      onBlur={(blur) => {
        const next = blur.relatedTarget;
        if (next instanceof Node && !blur.currentTarget.contains(next)) onClose();
      }}
    >
      {pending ? (
        <p className={styles.title}>{event.title}</p>
      ) : (
        <InlineText
          label="Título do compromisso"
          variant="title"
          value={event.title}
          maxLength={300}
          trim
          validate={(text) => (text === '' ? BLANK_EVENT_TITLE_MESSAGE : null)}
          onCommit={onRename}
        />
      )}
      <p className={styles.meta}>
        {formatRange(parseTime(event.startTime), parseTime(event.endTime))}
      </p>
      <button type="button" className={styles.delete} disabled={pending} onClick={onDelete}>
        Excluir
      </button>
    </div>,
    document.body,
  );
}
