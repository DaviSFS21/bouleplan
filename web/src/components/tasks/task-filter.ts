import { compareTasks } from '@/api/tasks';
import type { Initiative, Epic, Task, TaskStatus } from '@/api/types';

const STATUS_TITLES: Readonly<Record<TaskStatus, string>> = {
  to_do: 'A fazer',
  in_progress: 'Em andamento',
  done: 'Feito',
};

export const STATUSES: readonly TaskStatus[] = ['to_do', 'in_progress', 'done'];

export function statusTitle(status: TaskStatus): string {
  return STATUS_TITLES[status];
}

export function visibleTasks(
  tasks: readonly Task[],
  initiative: Initiative | null,
  epic: Epic | null,
): Task[] {
  if (epic) return tasks.filter((task) => task.epicId === epic.id);
  if (initiative) return tasks.filter((task) => task.initiativeId === initiative.id);
  return [...tasks];
}

export function tasksIn(tasks: readonly Task[], status: TaskStatus): Task[] {
  return tasks.filter((task) => task.status === status).sort(compareTasks);
}

export interface Progress {
  done: number;
  total: number;
}

function progressBy(
  tasks: readonly Task[] | undefined,
  keyOf: (task: Task) => string | null,
): ReadonlyMap<string, Progress> {
  const result = new Map<string, Progress>();
  for (const task of tasks ?? []) {
    const key = keyOf(task);
    if (key === null) continue;
    const current = result.get(key) ?? { done: 0, total: 0 };
    result.set(key, {
      done: current.done + (task.status === 'done' ? 1 : 0),
      total: current.total + 1,
    });
  }
  return result;
}

export function progressByInitiative(tasks: readonly Task[] | undefined) {
  return progressBy(tasks, (task) => task.initiativeId);
}

export function progressByEpic(tasks: readonly Task[] | undefined) {
  return progressBy(tasks, (task) => task.epicId);
}

export const NO_PROGRESS: Progress = { done: 0, total: 0 };
