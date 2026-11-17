'use client';

import { useDroppable } from '@dnd-kit/core';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarEvent } from '@/api/types';
import {
  DeadlineLines,
  DedicatedBlock,
  DraftEvent,
  DrawingBlock,
  FixedBlock,
  NowLine,
  PreviewBlock,
} from './blocks';
import { dayLabel } from './planner-dates';
import type { Preview } from './planner-drop';
import { HOUR_HEIGHT, formatClock } from './planner-time';
import { drawnSpan, pixelsFromMinutes, quarterAt, type Span } from './planner-geometry';
import type { BlockModel, DayModel } from './planner-model';
import styles from './day-column.module.css';

export interface Draft {
  date: string;
  span: Span;
}

interface DayColumnProps {
  day: DayModel;
  startHour: number;
  endHour: number;
  nowMinutes: number | null;
  preview: Preview | null;
  draft: Draft | null;
  onOpenTask: (taskId: string) => void;
  onRemoveBlock: (block: BlockModel) => void;
  onOpenEvent: (event: CalendarEvent, anchor: HTMLElement) => void;
  onDraw: (draft: Draft) => void;
  onCommitDraft: (title: string) => void;
  onCancelDraft: () => void;
}

export function DayColumn({
  day,
  startHour,
  endHour,
  nowMinutes,
  preview,
  draft,
  onOpenTask,
  onRemoveBlock,
  onOpenEvent,
  onDraw,
  onCommitDraft,
  onCancelDraft,
}: Readonly<DayColumnProps>) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${day.date}`,
    data: { kind: 'day', date: day.date },
  });
  const agenda = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState<Span | null>(null);
  const abort = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      abort.current?.();
    },
    [],
  );

  function pointerSpan(anchor: number, clientY: number): Span {
    const top = agenda.current?.getBoundingClientRect().top ?? 0;
    return drawnSpan(anchor, quarterAt(clientY, top, startHour));
  }

  // A press on empty time starts a span; releasing hands it to the draft.
  function startDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const top = agenda.current?.getBoundingClientRect().top ?? 0;
    const anchor = quarterAt(event.clientY, top, startHour);
    setDrawing(drawnSpan(anchor, anchor));
    function move(next: PointerEvent) {
      setDrawing(pointerSpan(anchor, next.clientY));
    }
    function stop() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      abort.current = null;
    }
    function up(next: PointerEvent) {
      stop();
      setDrawing(null);
      onDraw({ date: day.date, span: pointerSpan(anchor, next.clientY) });
    }
    function cancel() {
      stop();
      setDrawing(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    abort.current = cancel;
  }

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const resizing = preview?.resizing === true ? preview : null;
  const here = preview?.date === day.date ? preview : null;

  return (
    <div
      ref={(element) => {
        agenda.current = element;
        setNodeRef(element);
      }}
      role="group"
      aria-label={dayLabel(day.date)}
      className={[styles.agenda, isOver ? styles.over : ''].join(' ').trim()}
      style={{ height: (endHour - startHour) * HOUR_HEIGHT }}
      data-day={day.date}
      onPointerDown={startDrawing}
    >
      {hours.slice(0, -1).map((hour) => (
        <div
          key={hour}
          className={styles.hour}
          style={{ top: pixelsFromMinutes((hour - startHour) * 60) }}
        />
      ))}
      {day.events.map((event) => (
        <FixedBlock key={event.id} event={event} startHour={startHour} onOpen={onOpenEvent} />
      ))}
      {day.blocks.map((block) => (
        <DedicatedBlock
          key={block.item.id}
          model={block}
          startHour={startHour}
          span={resizing?.sourceId === block.item.id ? resizing.span : undefined}
          moving={preview?.sourceId === block.item.id && !preview.resizing}
          onOpen={onOpenTask}
          onRemove={onRemoveBlock}
        />
      ))}
      {here && !here.resizing ? (
        <PreviewBlock
          title={here.title}
          span={here.span}
          startHour={startHour}
          blocked={here.blocked}
        />
      ) : null}
      {drawing ? <DrawingBlock span={drawing} startHour={startHour} /> : null}
      {draft?.date === day.date ? (
        <DraftEvent
          key={`${draft.date}-${String(draft.span.start)}`}
          span={draft.span}
          startHour={startHour}
          onCommit={onCommitDraft}
          onCancel={onCancelDraft}
        />
      ) : null}
      <DeadlineLines deadlines={day.deadlines} onOpen={onOpenTask} />
      {nowMinutes === null ? null : (
        <NowLine
          top={pixelsFromMinutes(nowMinutes - startHour * 60)}
          label={`agora, ${formatClock(nowMinutes)}`}
        />
      )}
    </div>
  );
}
