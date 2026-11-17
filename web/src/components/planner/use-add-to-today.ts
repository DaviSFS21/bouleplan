'use client';

import { useCallback } from 'react';
import { usePlanner } from '@/api/planner';
import type { Task } from '@/api/types';
import { weekStartOf } from '@/components/tasks/task-week';
import { usePlannerActions } from './use-planner-actions';

// "Pôr na lista de hoje", for the menus of the board, the tray and the task panel.
export function useAddToToday(today: string, report: (message: string | null) => void) {
  const week = usePlanner(weekStartOf(today));
  const planner = usePlannerActions({ today, report });
  const items = week.data?.items;

  const isInToday = useCallback(
    (task: Task) =>
      items?.some(
        (item) => item.taskId === task.id && item.date === today && item.startTime === null,
      ) ?? false,
    [items, today],
  );

  return {
    isInToday,
    add: (task: Task) => planner.addToList(task, today),
  };
}
