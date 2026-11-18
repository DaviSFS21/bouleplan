'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { isPending } from '@/api/planner';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { Icon } from '@/components/icon/icon';
import { PrioritySelo } from '@/components/selo/selo';
import { arrowStep, useKeyboardMoves } from './keyboard-moves';
import { dayLabel } from './planner-dates';
import type { DragData } from './planner-drop';
import type { EntryModel } from './planner-model';
import { remainingLabel, stripTotal } from './planner-tasks';
import styles from './day-strip.module.css';

interface FichaProps {
  entry: EntryModel;
  moving: boolean;
  onOpen: (taskId: string, viaKeyboard?: boolean) => void;
  onRemove: (entry: EntryModel) => void;
}

function Ficha({ entry, moving, onOpen, onRemove }: Readonly<FichaProps>) {
  const { item, task, color } = entry;
  const pending = isPending(item.id);
  const keyboard = useKeyboardMoves();
  const { listeners, setNodeRef } = useDraggable({
    id: `ficha:${item.id}`,
    data: { kind: 'ficha', item, task } satisfies DragData,
    disabled: pending,
  });

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    const step = event.altKey && keyboard ? arrowStep(event.key) : null;
    if (keyboard && step?.quarters === 0) {
      event.preventDefault();
      if (!pending) keyboard.moveFicha({ item, task }, step.days);
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onOpen(task.id, true);
    }
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as Element).closest('button') === null) onOpen(task.id);
  }

  return (
    <li>
      <article
        {...listeners}
        ref={setNodeRef}
        tabIndex={0}
        aria-label={task.title}
        className={[styles.ficha, moving ? styles.source : ''].join(' ').trim()}
        style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
        data-task-id={task.id}
        data-ficha-id={item.id}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <PrioritySelo priority={task.priority} mini />
        <span className={styles.body}>
          <span className={styles.title}>{task.title}</span>
          <span className={styles.remaining}>{remainingLabel(task)}</span>
        </span>
        {keyboard ? (
          <div className={styles.menu}>
            <ActionMenu
              label={`Ações da tarefa ${task.title}`}
              items={[
                {
                  label: 'Reservar tempo…',
                  disabled: pending,
                  onSelect: () => {
                    keyboard.startReserve({ kind: 'ficha', item, task });
                  },
                },
                {
                  label: 'Tirar da lista',
                  disabled: pending,
                  onSelect: () => {
                    onRemove(entry);
                  },
                },
              ]}
            />
          </div>
        ) : null}
        <button
          type="button"
          className={styles.remove}
          disabled={pending}
          aria-label={`Tirar ${task.title} da lista do dia`}
          onClick={() => {
            onRemove(entry);
          }}
        >
          <Icon icon={X} size={14} aria-hidden="true" />
        </button>
      </article>
    </li>
  );
}

interface DayStripProps {
  date: string;
  entries: readonly EntryModel[];
  // The ficha being dragged, which stays dimmed in its list.
  movingItemId: string | null;
  targeted: boolean;
  onOpen: (taskId: string, viaKeyboard?: boolean) => void;
  onRemove: (entry: EntryModel) => void;
}

export function DayStrip({
  date,
  entries,
  movingItemId,
  targeted,
  onOpen,
  onRemove,
}: Readonly<DayStripProps>) {
  const { setNodeRef } = useDroppable({ id: `strip:${date}`, data: { kind: 'strip', date } });
  const total = stripTotal(entries.map(({ task }) => task));

  return (
    <section
      ref={setNodeRef}
      aria-label={`Lista de ${dayLabel(date)}`}
      className={[styles.strip, targeted ? styles.target : ''].join(' ').trim()}
      data-strip={date}
      tabIndex={-1}
    >
      <div className={styles.total}>
        {total.text}
        {total.extra ? <small>{total.extra}</small> : null}
      </div>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <Ficha
            key={entry.item.id}
            entry={entry}
            moving={movingItemId === entry.item.id}
            onOpen={onOpen}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}
