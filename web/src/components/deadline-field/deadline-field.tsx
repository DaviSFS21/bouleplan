'use client';

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import styles from './deadline-field.module.css';

const FORMAT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function formatDeadline(iso: string, today: string = localToday()): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const parts = new Map(
    FORMAT.formatToParts(new Date(year, month - 1, day)).map((part) => [part.type, part.value]),
  );
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
}

export function DeadlineField({
  label = 'Prazo',
  value,
  onChange,
  today = localToday(),
}: Readonly<DeadlineFieldProps>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const finished = useRef(false);
  const overdue = value !== null && value < today;
  const text = value === null ? 'sem prazo' : formatDeadline(value, today);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [editing]);

  function startEditing() {
    finished.current = false;
    setDraft(value ?? '');
    setEditing(true);
  }

  function finish(next: string | null, returnFocus: boolean) {
    finished.current = true;
    restoreFocus.current = returnFocus;
    setEditing(false);
    if (next !== null && next !== (value ?? '')) onChange(next === '' ? null : next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(null, true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      finish(event.currentTarget.value, true);
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    if (finished.current) return;
    finish(event.currentTarget.validity.badInput ? null : event.currentTarget.value, false);
  }

  return (
    <div className={styles.field}>
      {editing ? (
        <input
          ref={input}
          type="date"
          className={styles.input}
          aria-label={label}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          ref={trigger}
          type="button"
          className={[styles.value, overdue ? styles.overdue : ''].join(' ')}
          aria-label={`${label}: ${text}${overdue ? ', vencido' : ''}`}
          onClick={startEditing}
        >
          {text}
          {overdue ? <span className={styles.badge}>· vencido</span> : null}
        </button>
      )}
      {value !== null ? (
        <button
          type="button"
          className={styles.remove}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            finished.current = true;
            restoreFocus.current = true;
            setEditing(false);
            onChange(null);
          }}
        >
          Remover prazo
        </button>
      ) : null}
    </div>
  );
}
