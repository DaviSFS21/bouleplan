import type { ReactNode } from 'react';
import type { Initiative, Phase } from '@/api/types';
import styles from './initiative-board.module.css';

interface InitiativeBoardProps {
  initiative: Initiative | null;
  phase: Phase | null;
  detailsOpen: boolean;
  onOpenDetails: () => void;
}

export function InitiativeBoard({
  initiative,
  phase,
  detailsOpen,
  onOpenDetails,
}: Readonly<InitiativeBoardProps>) {
  let title: ReactNode = 'Todas as tarefas';
  if (phase) {
    title = phase.name;
  } else if (initiative) {
    title = (
      <button
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
      <p className={styles.empty}>Nenhuma tarefa ainda.</p>
    </div>
  );
}
