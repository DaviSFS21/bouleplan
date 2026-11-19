'use client';

import { useDraggable } from '@dnd-kit/core';
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { isPending } from '@/api/planner';
import { BLOCKED_DROP_MESSAGE } from '@/api/messages';
import type { CalendarEvent } from '@/api/types';
import { seloClassName } from '@/components/selo/selo';
import type { DragData } from './planner-drop';
import { arrowStep, useKeyboardMoves } from './keyboard-moves';
import { blockStyle, type Lane, type Span } from './planner-geometry';
import type { BlockModel, DeadlineModel } from './planner-model';
import { formatRange, parseTime } from './planner-time';
import styles from './blocks.module.css';

// Pointer events from anything interactive inside the block must not open the popover.
const INTERACTIVE = 'button, input, a';

function join(...names: (string | false | undefined)[]): string {
  return names.filter((name) => Boolean(name)).join(' ');
}

function laneStyle({ column, columns }: Lane): CSSProperties {
  const room = '(100% - 2 * var(--space-1))';
  return {
    left: `calc(var(--space-1) + ${room} * ${String(column)} / ${String(columns)})`,
    right: `calc(var(--space-1) + ${room} * ${String(columns - column - 1)} / ${String(columns)})`,
  };
}

interface DedicatedBlockProps {
  model: BlockModel;
  startHour: number;
  // Replaces the stored span while the bottom edge is being dragged.
  span?: Span;
  lane: Lane;
  moving: boolean;
  editing: boolean;
  onEdit: (block: BlockModel) => void;
}

export function DedicatedBlock({
  model,
  startHour,
  span,
  lane,
  moving,
  editing,
  onEdit,
}: Readonly<DedicatedBlockProps>) {
  const { item, task, color } = model;
  const shown = span ?? model.span;
  const disabled = isPending(item.id);
  const block = useDraggable({
    id: `block:${item.id}`,
    data: { kind: 'block', item, task } satisfies DragData,
    disabled,
  });
  const { listeners: handleListeners, setNodeRef: setHandleRef } = useDraggable({
    id: `resize:${item.id}`,
    data: { kind: 'resize', item, task } satisfies DragData,
    disabled,
  });
  const keyboard = useKeyboardMoves();
  const range = formatRange(shown.start, shown.end, true);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const step = event.altKey && keyboard ? arrowStep(event.key) : null;
    if (keyboard && step) {
      event.preventDefault();
      if (disabled) return;
      if (!event.shiftKey) keyboard.moveBlock({ item, task }, step);
      else if (step.days === 0) keyboard.resizeBlock({ item, task }, step.quarters);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onEdit(model);
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest(INTERACTIVE) === null) onEdit(model);
  }

  return (
    <div
      {...block.listeners}
      ref={(element) => {
        block.setNodeRef(element);
      }}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={editing}
      aria-label={`${task.title}, ${range}`}
      className={join(styles.event, styles.dedicated, moving && styles.source)}
      style={
        {
          ...blockStyle(shown, startHour),
          ...laneStyle(lane),
          '--ini': `var(--ini-${color})`,
        } as CSSProperties
      }
      data-block-id={item.id}
      data-block-task-id={task.id}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      <div className={styles.title}>
        <span
          aria-hidden="true"
          className={join(seloClassName(task.priority, true), styles.priority)}
          data-priority={task.priority}
        />
        <span className={styles.titleText}>{task.title}</span>
      </div>
      <span
        {...handleListeners}
        ref={(element) => {
          setHandleRef(element);
        }}
        className={styles.handle}
        aria-hidden="true"
        data-resize-handle={item.id}
      />
    </div>
  );
}

interface PreviewBlockProps {
  title: string;
  span: Span;
  startHour: number;
  blocked: boolean;
}

export function PreviewBlock({ title, span, startHour, blocked }: Readonly<PreviewBlockProps>) {
  return (
    <div
      aria-hidden="true"
      className={join(styles.event, styles.dedicated, styles.preview, blocked && styles.blocked)}
      style={blockStyle(span, startHour)}
      data-preview={blocked ? 'blocked' : 'free'}
    >
      <div className={styles.title}>
        <span className={styles.titleText}>{title}</span>
      </div>
      {blocked ? <div className={styles.reason}>{BLOCKED_DROP_MESSAGE}</div> : null}
    </div>
  );
}

interface FixedBlockProps {
  event: CalendarEvent;
  startHour: number;
  onOpen: (event: CalendarEvent) => void;
}

export function FixedBlock({ event, startHour, onOpen }: Readonly<FixedBlockProps>) {
  const span = { start: parseTime(event.startTime), end: parseTime(event.endTime) };
  return (
    <button
      type="button"
      className={join(styles.event, styles.fixed)}
      style={blockStyle(span, startHour)}
      aria-label={`${event.title}, ${formatRange(span.start, span.end, true)}`}
      aria-haspopup="dialog"
      data-event-id={event.id}
      onClick={() => {
        onOpen(event);
      }}
    >
      <span className={styles.title}>
        <span className={styles.titleText}>{event.title}</span>
      </span>
    </button>
  );
}

interface DraftEventProps {
  span: Span;
  startHour: number;
  onCommit: (title: string) => void;
  onCancel: () => void;
}

export function DraftEvent({ span, startHour, onCommit, onCancel }: Readonly<DraftEventProps>) {
  const finished = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  function finish(run: () => void) {
    if (finished.current) return;
    finished.current = true;
    run();
  }

  return (
    <div className={join(styles.event, styles.draft)} style={blockStyle(span, startHour)}>
      <input
        ref={field}
        type="text"
        className={styles.draftInput}
        aria-label="Título do compromisso"
        placeholder="Título"
        maxLength={300}
        onKeyDown={(keyboard) => {
          if (keyboard.key === 'Escape') {
            keyboard.stopPropagation();
            finish(onCancel);
          } else if (keyboard.key === 'Enter' && !keyboard.nativeEvent.isComposing) {
            keyboard.preventDefault();
            const title = keyboard.currentTarget.value.trim();
            if (title !== '')
              finish(() => {
                onCommit(title);
              });
          }
        }}
        onBlur={(blur) => {
          const title = blur.currentTarget.value.trim();
          finish(() => {
            if (title === '') onCancel();
            else onCommit(title);
          });
        }}
      />
    </div>
  );
}

export function DrawingBlock({ span, startHour }: Readonly<{ span: Span; startHour: number }>) {
  return (
    <div
      aria-hidden="true"
      className={join(styles.event, styles.draw)}
      style={blockStyle(span, startHour)}
    />
  );
}

interface DeadlineLinesProps {
  deadlines: readonly DeadlineModel[];
  // Distance from the bottom of the day to the line.
  bottom: number;
  onOpen: (taskId: string) => void;
}

export function DeadlineLines({ deadlines, bottom, onOpen }: Readonly<DeadlineLinesProps>) {
  if (deadlines.length === 0) return null;
  return (
    <div className={styles.deadlines} style={{ bottom }}>
      {deadlines.map(({ task, text }) => (
        <button
          key={task.id}
          type="button"
          className={styles.deadline}
          onClick={() => {
            onOpen(task.id);
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function NowLine({ top, label }: Readonly<{ top: number; label: string }>) {
  return <div role="img" aria-label={label} className={styles.now} style={{ top }} />;
}
