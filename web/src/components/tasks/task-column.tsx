'use client';

import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type { Task, TaskStatus } from '@/api/types';
import { TaskCard } from './task-card';
import type { TaskActions } from './task-menu';
import { statusTitle } from './task-filter';
import styles from './task-column.module.css';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: readonly Task[];
  pathOf: (task: Task) => string | null;
  colorOf: (task: Task) => string;
  now: Date;
  actions: TaskActions;
  openTaskId: string | null;
  // Where the dragged card would land, when it comes from another column.
  slotIndex: number | null;
  quickCreate: ReactNode;
}

export function TaskColumn({
  status,
  tasks,
  pathOf,
  colorOf,
  now,
  actions,
  openTaskId,
  slotIndex,
  quickCreate,
}: Readonly<TaskColumnProps>) {
  const { setNodeRef } = useDroppable({ id: status });
  const title = statusTitle(status);
  const cards = tasks.map((task) => (
    <TaskCard
      key={task.id}
      task={task}
      path={pathOf(task)}
      color={colorOf(task)}
      now={now}
      actions={actions}
      isOpen={task.id === openTaskId}
    />
  ));
  if (slotIndex !== null) {
    cards.splice(slotIndex, 0, <li key="slot" className={styles.slot} aria-hidden="true" />);
  }

  return (
    <section ref={setNodeRef} className={styles.column} aria-label={title} data-column={status}>
      <h2 className={styles.title}>{`${title} · ${String(tasks.length)}`}</h2>
      <ul className={styles.list}>{cards}</ul>
      {quickCreate}
    </section>
  );
}
