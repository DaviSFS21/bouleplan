'use client';

import { useTaskItems } from '@/api/planner';
import type { Task } from '@/api/types';
import { dayRow } from '@/components/planner/planner-dates';
import { formatHours, formatRange, parseTime } from '@/components/planner/planner-time';
import styles from './reserved-time.module.css';

export function reservedSummary(totalMinutes: number, estimatedEffort: number | null): string {
  if (totalMinutes === 0) return 'nada reservado ainda';
  return estimatedEffort === null
    ? `${formatHours(totalMinutes)} reservadas`
    : `${formatHours(totalMinutes)} de ${formatHours(Math.round(estimatedEffort * 60))} reservadas`;
}

export function ReservedTime({ task }: Readonly<{ task: Task }>) {
  const { data, isError } = useTaskItems(task.id);
  if (isError && !data) {
    return (
      <p role="alert" className={styles.meta}>
        Não foi possível carregar o tempo dedicado.
      </p>
    );
  }
  if (!data) return null;
  const blocks = data.flatMap((item) =>
    item.startTime === null || item.endTime === null
      ? []
      : [{ item, start: parseTime(item.startTime), end: parseTime(item.endTime) }],
  );
  const total = blocks.reduce((sum, { start, end }) => sum + end - start, 0);
  return (
    <>
      {blocks.length > 0 ? (
        <ul className={styles.blocks}>
          {blocks.map(({ item, start, end }) => (
            <li key={item.id}>
              <span className={styles.swatch} aria-hidden="true" />
              <span className={styles.day}>{dayRow(item.date)}</span>
              <span className={styles.meta}>
                {`${formatRange(start, end, true)} · ${formatHours(end - start)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.meta}>{reservedSummary(total, task.estimatedEffort)}</p>
    </>
  );
}
