'use client';

import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { weekDates, weekStartOf } from '@/components/tasks/task-week';
import { firstMonth, lastMonth, parseIso, toIso } from './iso-date';
import styles from './calendar.module.css';

export const RANGE_MESSAGE = 'Escolha uma data entre os anos 1 e 9999.';

const WEEKDAY_INITIAL = new Intl.DateTimeFormat('pt-BR', { weekday: 'narrow' });

const CLASS_NAMES = {
  root: styles.root,
  months: styles.months,
  month: styles.month,
  nav: styles.nav,
  button_previous: styles.step,
  button_next: styles.step,
  chevron: styles.chevron,
  month_caption: styles.caption,
  caption_label: styles.captionLabel,
  month_grid: styles.grid,
  weekday: styles.weekday,
  day: styles.day,
  day_button: styles.dayButton,
  selected: styles.selected,
  today: styles.today,
  outside: styles.outside,
};

interface CalendarProps {
  // The chosen day, or the first day of the chosen week when `weekly`.
  value: string | null;
  today: string;
  weekly?: boolean;
  onPick: (iso: string) => void;
  onClear: () => void;
}

export function Calendar({
  value,
  today,
  weekly = false,
  onPick,
  onClear,
}: Readonly<CalendarProps>) {
  const parsed = value === null ? null : parseIso(value);
  const outside = value !== null && parsed === null;
  const todayDate = parseIso(today) ?? new Date();
  const week =
    weekly && value !== null ? weekDates(weekStartOf(value)).map((day) => parseIso(day)) : [];
  const inWeek = week.filter((day) => day !== null);
  const shared = {
    locale: ptBR,
    weekStartsOn: weekly ? 1 : 0,
    defaultMonth: parsed ?? todayDate,
    startMonth: firstMonth(),
    endMonth: lastMonth(),
    today: todayDate,
    autoFocus: true,
    formatters: { formatWeekdayName: (day: Date) => WEEKDAY_INITIAL.format(day).toUpperCase() },
    classNames: weekly ? { ...CLASS_NAMES, selected: styles.week } : CLASS_NAMES,
  } as const;

  return (
    <div className={styles.calendar}>
      {weekly ? (
        <DayPicker
          {...shared}
          mode="multiple"
          selected={inWeek}
          onSelect={(_days, day) => {
            onPick(toIso(day));
          }}
        />
      ) : (
        <DayPicker
          {...shared}
          mode="single"
          required
          selected={parsed ?? undefined}
          onSelect={(day) => {
            onPick(toIso(day));
          }}
        />
      )}
      {outside ? (
        <p role="alert" className={styles.error}>
          {RANGE_MESSAGE}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            onPick(today);
          }}
        >
          Hoje
        </button>
        <button type="button" className={styles.action} disabled={value === null} onClick={onClear}>
          Limpar
        </button>
      </div>
    </div>
  );
}
