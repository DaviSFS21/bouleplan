'use client';

import { useDraggable } from '@dnd-kit/core';
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { isPending } from '@/api/planner';
import { BLOCKED_DROP_MESSAGE } from '@/api/messages';
import type { CalendarEvent } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { PrioritySelo } from '@/components/selo/selo';
import type { DragData } from './planner-drop';
import { arrowStep, useKeyboardMoves } from './keyboard-moves';
import { blockStyle, type Lane, type Span } from './planner-geometry';
import type { BlockModel, DeadlineModel } from './planner-model';
import { formatRange, parseTime } from './planner-time';
import styles from './blocks.module.css';

// Pointer and key events from the menu must not open the task.
const INTERACTIVE = 'button, input, a, [role="menu"]';

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
  onOpen: (taskId: string) => void;
  onRemove: (block: BlockModel) => void;
}

export function DedicatedBlock({
  model,
  startHour,
  span,
  lane,
  moving,
  onOpen,
  onRemove,
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
  const root = useRef<HTMLDivElement | null>(null);
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
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      root.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.click();
    }
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest(INTERACTIVE) === null) onOpen(task.id);
  }

  return (
    <div
      {...block.listeners}
      ref={(element) => {
        root.current = element;
        block.setNodeRef(element);
      }}
      role="group"
      tabIndex={0}
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
        <PrioritySelo priority={task.priority} mini />
        <span className={styles.titleText}>{task.title}</span>
      </div>
      <div className={styles.menu}>
        <ActionMenu
          label={`Ações do tempo de ${task.title}`}
          items={[
            {
              label: 'Abrir tarefa',
              onSelect: () => {
                onOpen(task.id);
              },
            },
            {
              label: 'Tirar da agenda',
              disabled,
              onSelect: () => {
                onRemove(model);
              },
            },
          ]}
        />
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
  onOpen: (taskId: string) => void;
}

export function DeadlineLines({ deadlines, onOpen }: Readonly<DeadlineLinesProps>) {
  if (deadlines.length === 0) return null;
  return (
    <div className={styles.deadlines}>
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
