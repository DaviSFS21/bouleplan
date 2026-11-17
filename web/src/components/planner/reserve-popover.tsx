'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type SubmitEvent } from 'react';
import { createPortal } from 'react-dom';
import { placeMenu } from '@/components/action-menu/place-menu';
import { NO_ROOM_MESSAGE, type ReserveOrigin } from './keyboard-moves';
import { dayLabel } from './planner-dates';
import { MAX_END, QUARTER, formatClock } from './planner-time';
import styles from './reserve-popover.module.css';

const DEFAULT_START = 9 * 60;
const STARTS = Array.from({ length: (MAX_END + QUARTER) / QUARTER }, (_, index) => index * QUARTER);

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
  const box = useRef<HTMLFormElement>(null);
  const first = useRef<HTMLSelectElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(DEFAULT_START);
  const [refused, setRefused] = useState(false);
  const ids = { day: useId(), start: useId() };

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(anchorSelector);
    const size = box.current?.getBoundingClientRect();
    if (!element || !size) return;
    setPosition(
      placeMenu(element.getBoundingClientRect(), size, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    );
  }, [anchorSelector]);

  useEffect(() => {
    first.current?.focus();
  }, []);

  useEffect(() => {
    function closeOnOutsidePointer(pointer: PointerEvent) {
      const target = pointer.target;
      if (!(target instanceof Node)) return;
      const anchor = document.querySelector(anchorSelector);
      if (box.current?.contains(target) === true || anchor?.contains(target) === true) return;
      onCancel();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [anchorSelector, onCancel]);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    setRefused(!onReserve(date, start));
  }

  return createPortal(
    <form
      ref={box}
      role="dialog"
      aria-label="Reservar tempo"
      className={styles.popover}
      style={position}
      onSubmit={submit}
      onKeyDown={(keyboard) => {
        if (keyboard.key === 'Escape') {
          keyboard.stopPropagation();
          onCancel();
        }
      }}
      onBlur={(blur) => {
        const next = blur.relatedTarget;
        if (next instanceof Node && !blur.currentTarget.contains(next)) onCancel();
      }}
    >
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
          {STARTS.map((minutes) => (
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
    </form>,
    document.body,
  );
}
