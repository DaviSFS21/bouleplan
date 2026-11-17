import type { ReactNode, RefObject } from 'react';
import type { Initiative, Phase, Task } from '@/api/types';
import { TaskBoard } from '@/components/tasks/task-board';
import styles from './initiative-board.module.css';

interface InitiativeBoardProps {
  initiative: Initiative | null;
  phase: Phase | null;
  detailsOpen: boolean;
  onOpenDetails: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
  initiatives: readonly Initiative[];
  tasks: readonly Task[] | undefined;
  tasksFailed: boolean;
  onRetryTasks: () => void;
  now?: Date;
}

export function InitiativeBoard({
  initiative,
  phase,
  detailsOpen,
  onOpenDetails,
  openerRef,
  initiatives,
  tasks,
  tasksFailed,
  onRetryTasks,
  now,
}: Readonly<InitiativeBoardProps>) {
  let title: ReactNode = 'Todas as tarefas';
  if (phase) {
    title = phase.name;
  } else if (initiative) {
    title = (
      <button
        ref={openerRef}
        type="button"
        className={styles.titleButton}
        aria-expanded={detailsOpen}
        onClick={onOpenDetails}
      >
        {initiative.name}
      </button>
    );
  }

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        {initiative ? (
          <p className={styles.overline}>
            {phase ? (
              <button
                ref={openerRef}
                type="button"
                className={styles.overlineButton}
                aria-expanded={detailsOpen}
                onClick={onOpenDetails}
              >
                {initiative.name}
              </button>
            ) : (
              'Iniciativa'
            )}
          </p>
        ) : null}
        <h1 className={styles.title}>{title}</h1>
      </header>
      <TaskBoard
        tasks={tasks}
        failed={tasksFailed}
        onRetry={onRetryTasks}
        initiatives={initiatives}
        initiative={initiative}
        phase={phase}
        now={now}
      />
    </div>
  );
}
