'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Calendar } from '@/components/date-picker/calendar';
import { DatePopover } from '@/components/date-picker/date-popover';
import { localToday } from '@/components/deadline-field/deadline-field';
import { Presence } from '@/components/motion/presence';
import { Icon } from '@/components/icon/icon';
import { currentWeekStart, stepWeek, weekRange, weekStartOf, weekText } from './task-week';
import styles from './task-panel.module.css';

interface WeekFieldProps {
  value: string | null;
  now: Date;
  onChange: (weekStart: string | null) => void;
}

export function WeekField({ value, now, onChange }: Readonly<WeekFieldProps>) {
  const thisWeek = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const anchor = useCallback(() => picker.current, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  const previous = value === null ? null : stepWeek(value, -1);
  const next = value === null ? null : stepWeek(value, 1);

  return (
    <div role="group" aria-label="Semana" className={styles.week}>
      <span className={styles.weekText}>
        {weekText(value)}
        {value === null ? null : <span className={styles.weekRange}>{weekRange(value)}</span>}
      </span>
      <span className={styles.weekControls}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Semana anterior"
          disabled={previous === null}
          onClick={() => {
            if (previous !== null) onChange(previous);
          }}
        >
          <Icon icon={ChevronLeft} size={14} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Próxima semana"
          disabled={next === null}
          onClick={() => {
            if (next !== null) onChange(next);
          }}
        >
          <Icon icon={ChevronRight} size={14} />
        </button>
        <button
          ref={picker}
          type="button"
          className={styles.iconButton}
          aria-label="Escolher semana no calendário"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <Icon icon={CalendarDays} size={14} />
        </button>
        <button
          ref={thisWeek}
          type="button"
          className={styles.textButton}
          onClick={() => {
            const start = currentWeekStart(now);
            if (start !== value) onChange(start);
          }}
        >
          Esta semana
        </button>
        {value === null ? null : (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              thisWeek.current?.focus();
              onChange(null);
            }}
          >
            Limpar
          </button>
        )}
      </span>
      <Presence>
        {open ? (
          <DatePopover key="week" anchor={anchor} label="Escolher semana" onClose={close}>
            <Calendar
              weekly
              value={value}
              today={localToday(now)}
              onPick={(day) => {
                setOpen(false);
                const start = weekStartOf(day);
                if (start !== value) onChange(start);
              }}
              onClear={() => {
                setOpen(false);
                if (value !== null) onChange(null);
              }}
            />
          </DatePopover>
        ) : null}
      </Presence>
    </div>
  );
}
