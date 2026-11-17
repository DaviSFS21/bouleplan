import { compareTasks } from '@/api/tasks';
import type { Task } from '@/api/types';
import { formatHours } from './planner-time';

export const RISK_FILTER = 'risk';

export function reservedOf(task: Task): { total: number; byDeadline: number } {
  return { total: task.reservedMinutes, byDeadline: task.reservedByDeadlineMinutes };
}

function estimateMinutes(task: Task): number | null {
  return task.estimatedEffort === null ? null : Math.round(task.estimatedEffort * 60);
}

// Minutes left to reserve over all blocks; null without an estimate.
export function remainingMinutes(task: Task): number | null {
  const estimate = estimateMinutes(task);
  return estimate === null ? null : Math.max(0, estimate - reservedOf(task).total);
}

export function remainingLabel(task: Task): string {
  const remaining = remainingMinutes(task);
  if (remaining === null) return 'sem estimativa';
  return remaining === 0 ? 'tudo reservado' : formatHours(remaining);
}

export function trayMeta(task: Task): string {
  const remaining = remainingMinutes(task);
  if (remaining === null) return 'sem estimativa';
  if (remaining === 0) return 'tudo reservado';
  const estimate = estimateMinutes(task) ?? 0;
  return reservedOf(task).total === 0
    ? `${formatHours(remaining)} a reservar`
    : `${formatHours(remaining)} a reservar de ${formatHours(estimate)}`;
}

// Minutes the deadline still lacks; null without an estimate.
export function missingByDeadline(task: Task): number | null {
  const estimate = estimateMinutes(task);
  return estimate === null ? null : Math.max(0, estimate - reservedOf(task).byDeadline);
}

export function isAtRisk(task: Task, today: string, weekEnd: string): boolean {
  if (task.status === 'done' || task.deadline === null) return false;
  if (task.deadline < today || task.deadline > weekEnd) return false;
  const missing = missingByDeadline(task);
  return missing === null ? reservedOf(task).byDeadline === 0 : missing > 0;
}

export function atRiskTasks(tasks: readonly Task[], today: string, weekEnd: string): Task[] {
  return tasks.filter((task) => isAtRisk(task, today, weekEnd));
}

export function riskLabel(task: Task): string {
  const missing = missingByDeadline(task);
  return missing === null ? 'sem tempo reservado' : `faltam ${formatHours(missing)}`;
}

export function trayTasks(
  tasks: readonly Task[],
  weekStart: string,
  filter: string | null,
  atRisk: readonly Task[],
): Task[] {
  const planned = (task: Task) => (task.plannedWeekStart === weekStart ? 0 : 1);
  const risky = new Set(atRisk.map(({ id }) => id));
  return tasks
    .filter((task) => task.status !== 'done')
    .filter((task) => {
      if (filter === null) return true;
      return filter === RISK_FILTER ? risky.has(task.id) : task.initiativeId === filter;
    })
    .sort((a, b) => planned(a) - planned(b) || compareTasks(a, b));
}

export interface StripTotal {
  text: string;
  extra: string | null;
}

export function stripTotal(tasks: readonly Task[]): StripTotal {
  if (tasks.length === 0) return { text: 'sem horário', extra: null };
  let total = 0;
  let unestimated = 0;
  for (const task of tasks) {
    const remaining = remainingMinutes(task);
    if (remaining === null) unestimated += 1;
    else total += remaining;
  }
  return {
    text: total > 0 ? `${formatHours(total)} sem horário` : 'sem horário',
    extra: unestimated > 0 ? `+${String(unestimated)} sem estimativa` : null,
  };
}
