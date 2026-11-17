'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { Icon } from '@/components/icon/icon';
import { currentWeekStart, stepWeek, weekRange, weekText } from './task-week';
import styles from './task-panel.module.css';

interface WeekFieldProps {
  value: string | null;
  now: Date;
  onChange: (weekStart: string | null) => void;
}

export function WeekField({ value, now, onChange }: Readonly<WeekFieldProps>) {
  const thisWeek = useRef<HTMLButtonElement>(null);
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
    </div>
  );
}
