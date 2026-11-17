import type { Initiative } from '@/api/types';
import styles from './initiative-board.module.css';

interface InitiativeBoardProps {
  initiative: Initiative | null;
  detailsOpen: boolean;
  onOpenDetails: () => void;
}

export function InitiativeBoard({
  initiative,
  detailsOpen,
  onOpenDetails,
}: Readonly<InitiativeBoardProps>) {
  return (
    <div className={styles.board}>
      <header className={styles.header}>
        {initiative ? <p className={styles.overline}>Iniciativa</p> : null}
        <h1 className={styles.title}>
          {initiative ? (
            <button
              type="button"
              className={styles.titleButton}
              aria-expanded={detailsOpen}
              onClick={onOpenDetails}
            >
              {initiative.name}
            </button>
          ) : (
            'Todas as tarefas'
          )}
        </h1>
      </header>
      <p className={styles.empty}>Nenhuma tarefa ainda.</p>
    </div>
  );
}
