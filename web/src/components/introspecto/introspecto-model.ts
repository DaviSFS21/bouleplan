import { compareTasks } from '@/api/tasks';
import type { Task, TaskChanges } from '@/api/types';
import { formatDeadline, localToday } from '@/components/deadline-field/deadline-field';
import { weekOfInstant } from './introspecto-week';

export interface WeekSummary {
  done: Task[];
  behind: Task[];
}

export function summarize(tasks: readonly Task[], weekStart: string): WeekSummary {
  const sorted = [...tasks].sort(compareTasks);
  return {
    done: sorted.filter(
      (task) =>
        task.status === 'done' &&
        (task.plannedWeekStart === weekStart || weekOfInstant(task.updatedAt) === weekStart),
    ),
    behind: sorted.filter((task) => task.status !== 'done' && task.plannedWeekStart === weekStart),
  };
}

// Planning a task moves its planned week off the reviewed one, so what was left behind is remembered.
export function rememberLeft(
  left: ReadonlySet<string>,
  tasks: readonly Task[],
  weekStart: string,
): ReadonlySet<string> {
  const fresh = summarize(tasks, weekStart).behind.filter((task) => !left.has(task.id));
  return fresh.length === 0 ? left : new Set([...left, ...fresh.map(({ id }) => id)]);
}

// The tasks still open among those remembered, in the API order.
export function leftBehind(tasks: readonly Task[], left: ReadonlySet<string>): Task[] {
  return tasks.filter((task) => task.status !== 'done' && left.has(task.id)).sort(compareTasks);
}

export interface PlanGroup {
  initiativeId: string;
  tasks: Task[];
}

export interface Plan {
  behind: Task[];
  groups: PlanGroup[];
}

// Open work by initiative; what was left behind sits in its own tray, not in the group.
export function buildPlan(
  tasks: readonly Task[],
  behind: readonly Task[],
  initiativeIds: readonly string[],
): Plan {
  const left = new Set(behind.map(({ id }) => id));
  const open = tasks
    .filter((task) => task.status !== 'done' && !left.has(task.id))
    .sort(compareTasks);
  const groups = initiativeIds
    .map((initiativeId) => ({
      initiativeId,
      tasks: open.filter((task) => task.initiativeId === initiativeId),
    }))
    .filter((group) => group.tasks.length > 0);
  return { behind: [...behind], groups };
}

export function isPlanned(task: Task, nextWeek: string): boolean {
  return task.plannedWeekStart === nextWeek;
}

// Unchecking gives a task left behind its reviewed week back, so it is still left behind.
export function planChange(task: Task, nextWeek: string, restoreWeek: string | null): TaskChanges {
  return { plannedWeekStart: isPlanned(task, nextWeek) ? restoreWeek : nextWeek };
}

// A due date here is a plain fact, never "late".
export function deadlineText(deadline: string | null, now: Date): string {
  return deadline === null ? 'sem prazo' : `prazo ${formatDeadline(deadline, localToday(now))}`;
}

function markedOf(tasks: readonly Task[], nextWeek: string): number {
  return tasks.filter((task) => isPlanned(task, nextWeek)).length;
}

export function groupCounter(tasks: readonly Task[], nextWeek: string): string {
  const marked = markedOf(tasks, nextWeek);
  return marked > 0
    ? `${String(marked)} de ${String(tasks.length)} marcadas`
    : `${String(tasks.length)} a fazer`;
}

export function trayCounter(tasks: readonly Task[], nextWeek: string): string {
  return `${String(markedOf(tasks, nextWeek))} de ${String(tasks.length)} entram`;
}

export interface Tally {
  main: string;
  extra: string | null;
}

const HUNDREDTHS = 100;

export function tallyText(marked: readonly Task[]): Tally {
  if (marked.length === 0) return { main: 'Nada marcado ainda', extra: null };
  let hundredths = 0;
  let without = 0;
  for (const { estimatedEffort } of marked) {
    if (estimatedEffort === null) without += 1;
    else hundredths += Math.round(estimatedEffort * HUNDREDTHS);
  }
  const noun = marked.length === 1 ? 'tarefa' : 'tarefas';
  const hours = String(hundredths / HUNDREDTHS).replace('.', ',');
  return {
    main: `${String(marked.length)} ${noun} · ${hours}h`,
    extra: without > 0 ? `· ${String(without)} sem estimativa` : null,
  };
}
