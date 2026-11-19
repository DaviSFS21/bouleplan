import { Menu } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { Initiative, Epic, Task } from '@/api/types';
import { Icon } from '@/components/icon/icon';
import { TaskBoard, type TaskPanelControl } from '@/components/tasks/task-board';
import styles from './initiative-board.module.css';

interface InitiativeBoardProps {
  initiative: Initiative | null;
  epic: Epic | null;
  detailsOpen: boolean;
  onOpenDetails: () => void;
  openerRef: RefObject<HTMLButtonElement | null>;
  initiatives: readonly Initiative[];
  tasks: readonly Task[] | undefined;
  tasksFailed: boolean;
  onRetryTasks: () => void;
  taskPanel: TaskPanelControl;
  // Below the desktop width the index is a drawer, opened from here.
  drawerButton?: { open: boolean; onOpen: () => void };
  drawerOpenerRef?: RefObject<HTMLButtonElement | null>;
  // With no initiative at all, a narrow screen offers to create the first one from here.
  onCreateInitiative?: () => void;
  now?: Date;
}

export function InitiativeBoard({
  initiative,
  epic,
  detailsOpen,
  onOpenDetails,
  openerRef,
  initiatives,
  tasks,
  tasksFailed,
  onRetryTasks,
  taskPanel,
  drawerButton,
  drawerOpenerRef,
  onCreateInitiative,
  now,
}: Readonly<InitiativeBoardProps>) {
  let title: ReactNode = 'Todas as tarefas';
  if (epic) {
    title = epic.name;
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
        {drawerButton ? (
          <button
            ref={drawerOpenerRef}
            type="button"
            className={styles.drawerButton}
            aria-haspopup="dialog"
            aria-expanded={drawerButton.open}
            onClick={drawerButton.onOpen}
          >
            <Icon icon={Menu} size={18} aria-hidden="true" />
            Iniciativas
          </button>
        ) : null}
        {drawerButton && onCreateInitiative && initiatives.length === 0 ? (
          <div className={styles.firstUse}>
            <p className={styles.firstUseNote}>Nenhuma iniciativa ainda.</p>
            <button type="button" className={styles.drawerButton} onClick={onCreateInitiative}>
              + Nova iniciativa
            </button>
          </div>
        ) : null}
        {initiative ? (
          <p className={styles.overline}>
            {epic ? (
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
        key={`${initiative?.id ?? 'all'}:${epic?.id ?? ''}`}
        tasks={tasks}
        failed={tasksFailed}
        onRetry={onRetryTasks}
        initiatives={initiatives}
        initiative={initiative}
        epic={epic}
        taskPanel={taskPanel}
        now={now}
      />
    </div>
  );
}
