'use client';

import { useCallback, useId, useRef, useState, type SubmitEvent } from 'react';
import { Popover } from '@/components/floating/popover';
import { NO_ROOM_MESSAGE, type ReserveOrigin } from './keyboard-moves';
import { remainingMinutes } from './planner-tasks';
import { dayLabel } from './planner-dates';
import { MAX_END, QUARTER, durationFor, formatClock } from './planner-time';
import styles from './reserve-popover.module.css';

const DEFAULT_START = 9 * 60;
const STARTS = Array.from({ length: (MAX_END + QUARTER) / QUARTER }, (_, index) => index * QUARTER);

// Only the starts where the whole span fits before the end of the day.
function startsFor(duration: number): number[] {
  return STARTS.filter((start) => start + duration <= MAX_END);
}

interface ReservePopoverProps {
  origin: ReserveOrigin;
  dates: readonly string[];
  initialDate: string;
  anchorSelector: string;
  // Says whether the time fitted; when it did not, the popover stays open.
  onReserve: (date: string, start: number) => boolean;
  onCancel: () => void;
}

export function ReservePopover({
  origin,
  dates,
  initialDate,
  anchorSelector,
  onReserve,
  onCancel,
}: Readonly<ReservePopoverProps>) {
  const first = useRef<HTMLSelectElement>(null);
  const [date, setDate] = useState(initialDate);
  const starts = startsFor(durationFor(remainingMinutes(origin.task)));
  const [start, setStart] = useState(Math.min(DEFAULT_START, starts.at(-1) ?? 0));
  const [refused, setRefused] = useState(false);
  const ids = { day: useId(), start: useId() };

  const anchor = useCallback(
    () => document.querySelector<HTMLElement>(anchorSelector),
    [anchorSelector],
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    setRefused(!onReserve(date, start));
  }

  const form = (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.title}>{origin.task.title}</p>
      <div className={styles.field}>
        <label htmlFor={ids.day}>Dia</label>
        <select
          ref={first}
          id={ids.day}
          className={styles.select}
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
      <div className={styles.field}>
        <label htmlFor={ids.start}>Início</label>
        <select
          id={ids.start}
          className={styles.select}
          value={start}
          onChange={(change) => {
            setStart(Number(change.target.value));
            setRefused(false);
          }}
        >
          {starts.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatClock(minutes)}
            </option>
          ))}
        </select>
      </div>
      {refused ? <p className={styles.refusal}>{NO_ROOM_MESSAGE}</p> : null}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit}>
          Reservar
        </button>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <Popover
      anchor={anchor}
      label="Reservar tempo"
      className={styles.popover}
      initialFocus={first}
      onClose={onCancel}
    >
      {form}
    </Popover>
  );
}
