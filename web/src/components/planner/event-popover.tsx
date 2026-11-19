'use client';

import { useCallback } from 'react';
import { BLANK_EVENT_TITLE_MESSAGE } from '@/api/messages';
import { isPending } from '@/api/planner';
import type { CalendarEvent } from '@/api/types';
import { InlineText } from '@/components/inline-text/inline-text';
import { Popover } from '@/components/floating/popover';
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
  const pending = isPending(event.id);
  const eventId = event.id;
  // The block is rendered again when the server gives the event its id, so it is looked up each time.
  const anchor = useCallback(() => anchorOf(eventId), [eventId]);

  const content = (
    <div className={styles.stack}>
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
    </div>
  );

  return (
    <Popover anchor={anchor} label="Compromisso" className={styles.popover} onClose={onClose}>
      {content}
    </Popover>
  );
}
