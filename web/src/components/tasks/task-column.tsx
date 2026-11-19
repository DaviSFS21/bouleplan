'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { Task, TaskStatus } from '@/api/types';
import { Presence } from '@/components/motion/presence';
import { FADE, preset } from '@/components/motion/tokens';
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
  draggable?: boolean;
  // Set when the phone shows one column at a time, as the panel of the state tabs.
  tabPanel?: { id: string; role: 'tabpanel'; 'aria-labelledby': string };
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
  tabPanel,
  draggable = true,
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
      draggable={draggable}
    />
  ));
  if (slotIndex !== null) {
    cards.splice(slotIndex, 0, <li key="slot" className={styles.slot} aria-hidden="true" />);
  }

  return (
    <motion.section
      ref={setNodeRef}
      {...preset(FADE)}
      {...tabPanel}
      className={styles.column}
      aria-label={tabPanel ? undefined : title}
      data-column={status}
    >
      <h2 className={styles.title}>{`${title} · ${String(tasks.length)}`}</h2>
      <ul className={styles.list}>
        <Presence mode="popLayout">{cards}</Presence>
      </ul>
      {quickCreate}
    </motion.section>
  );
}
