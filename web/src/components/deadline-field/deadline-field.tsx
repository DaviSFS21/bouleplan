'use client';

import { useCallback, useRef, useState } from 'react';
import { Calendar } from '@/components/date-picker/calendar';
import { DatePopover } from '@/components/date-picker/date-popover';
import { atNoon } from '@/components/date-picker/iso-date';
import { Presence } from '@/components/motion/presence';
import styles from './deadline-field.module.css';

const FORMAT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDeadline(iso: string, today: string = localToday()): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map((part) => Number(part));
  const date = atNoon(year, month - 1, day);
  const parts = new Map(FORMAT.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = parts.get('weekday')?.replace('.', '') ?? '';
  const monthName = parts.get('month')?.replace('.', '') ?? '';
  const label = `${weekday}, ${parts.get('day') ?? ''} ${monthName}`;
  return year === Number(today.slice(0, 4)) ? label : `${label} ${String(year)}`;
}

export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
}

interface DeadlineFieldProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  today?: string;
  // Replaces the default wording and overdue style, as the card words its deadline.
  display?: { text: string; alert: boolean };
}

export function DeadlineField({
  label = 'Prazo',
  value,
  onChange,
  today = localToday(),
  display,
}: Readonly<DeadlineFieldProps>) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = useCallback(() => trigger.current, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const overdue = display ? display.alert : value !== null && value < today;
  const text = display?.text ?? (value === null ? 'sem prazo' : formatDeadline(value, today));

  function choose(next: string | null) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div className={styles.field}>
      <button
        ref={trigger}
        type="button"
        className={[styles.value, overdue ? styles.overdue : ''].join(' ')}
        aria-label={`${label}: ${text}${overdue && !display ? ', vencido' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {text}
        {overdue && !display ? <span className={styles.badge}>· vencido</span> : null}
      </button>
      {value !== null ? (
        <button
          type="button"
          className={styles.remove}
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
            onChange(null);
          }}
        >
          Remover prazo
        </button>
      ) : null}
      <Presence>
        {open ? (
          <DatePopover
            key="date"
            anchor={anchor}
            label={`Escolher ${label.toLowerCase()}`}
            onClose={close}
          >
            <Calendar
              value={value}
              today={today}
              onPick={choose}
              onClear={() => {
                choose(null);
              }}
            />
          </DatePopover>
        ) : null}
      </Presence>
    </div>
  );
}
