'use client';

import { useCallback, useId, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { isPending } from '@/api/planner';
import { Popover } from '@/components/floating/popover';
import { PrioritySelo } from '@/components/selo/selo';
import { NO_ROOM_MESSAGE } from './keyboard-moves';
import { dayLabel } from './planner-dates';
import type { Span } from './planner-geometry';
import type { BlockModel } from './planner-model';
import { MAX_END, QUARTER, formatClock, formatDuration } from './planner-time';
import reserve from './reserve-popover.module.css';
import styles from './block-popover.module.css';

const STARTS = Array.from({ length: (MAX_END - QUARTER) / QUARTER + 1 }, (_, i) => i * QUARTER);

function endsFor(start: number): number[] {
  return Array.from({ length: (MAX_END - start) / QUARTER }, (_, i) => start + (i + 1) * QUARTER);
}

interface BlockPopoverProps {
  block: BlockModel;
  dates: readonly string[];
  onClose: () => void;
  // Says whether the time fitted; when it did not, the popover stays open.
  onSave: (date: string, span: Span) => boolean;
  onRemove: () => void;
  onOpenTask: () => void;
}

interface FormProps extends BlockPopoverProps {
  first: RefObject<HTMLSelectElement | null>;
}

function BlockForm({
  block,
  dates,
  onClose,
  onSave,
  onRemove,
  onOpenTask,
  first,
}: Readonly<FormProps>) {
  const { item, task } = block;
  const [date, setDate] = useState(item.date);
  const [start, setStart] = useState(block.span.start);
  const [end, setEnd] = useState(block.span.end);
  const [refused, setRefused] = useState(false);
  const pending = isPending(item.id);
  const ids = { day: useId(), start: useId(), end: useId() };

  function changeStart(next: number) {
    setEnd(Math.min(MAX_END, end + next - start));
    setStart(next);
    setRefused(false);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const unchanged = date === item.date && start === block.span.start && end === block.span.end;
    if (unchanged) onClose();
    else setRefused(!onSave(date, { start, end }));
  }

  return (
    <form className={reserve.form} onSubmit={submit}>
      <div className={styles.head}>
        <PrioritySelo priority={task.priority} mini />
        <button
          type="button"
          className={styles.link}
          aria-label={`Abrir tarefa ${task.title}`}
          onClick={onOpenTask}
        >
          {task.title}
        </button>
      </div>
      <div className={reserve.field}>
        <label htmlFor={ids.day}>Dia</label>
        <select
          ref={first}
          id={ids.day}
          className={reserve.select}
          value={date}
          onChange={(change) => {
            setDate(change.target.value);
            setRefused(false);
          }}
        >
          {dates.map((value) => (
            <option key={value} value={value}>
              {dayLabel(value)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.times}>
        <div className={reserve.field}>
          <label htmlFor={ids.start}>Início</label>
          <select
            id={ids.start}
            className={reserve.select}
            value={start}
            onChange={(change) => {
              changeStart(Number(change.target.value));
            }}
          >
            {STARTS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatClock(minutes)}
              </option>
            ))}
          </select>
        </div>
        <div className={reserve.field}>
          <label htmlFor={ids.end}>Fim</label>
          <select
            id={ids.end}
            className={reserve.select}
            value={end}
            onChange={(change) => {
              setEnd(Number(change.target.value));
              setRefused(false);
            }}
          >
            {endsFor(start).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatClock(minutes)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={styles.meta}>{formatDuration(end - start)}</p>
      {refused ? (
        <p role="alert" className={reserve.refusal}>
          {NO_ROOM_MESSAGE}
        </p>
      ) : null}
      <div className={reserve.actions}>
        <button type="submit" className={reserve.submit} disabled={pending}>
          Salvar
        </button>
        <button type="button" className={reserve.cancel} disabled={pending} onClick={onRemove}>
          Tirar da agenda
        </button>
        <button type="button" className={reserve.cancel} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function BlockPopover(props: Readonly<BlockPopoverProps>) {
  const first = useRef<HTMLSelectElement>(null);
  const { block, onClose } = props;
  const blockId = block.item.id;
  const anchor = useCallback(
    () => document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`),
    [blockId],
  );
  return (
    <Popover
      anchor={anchor}
      label={block.task.title}
      onClose={onClose}
      initialFocus={first}
      className={styles.popover}
    >
      <BlockForm {...props} first={first} />
    </Popover>
  );
}
