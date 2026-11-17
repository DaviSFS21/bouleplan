import type { Initiative } from '@/api/types';
import styles from './initiative-board.module.css';

export function InitiativeBoard({ initiative }: Readonly<{ initiative: Initiative | null }>) {
  return (
    <div className={styles.board}>
      <header className={styles.header}>
        {initiative ? <p className={styles.overline}>Iniciativa</p> : null}
        <h1 className={styles.title}>{initiative?.name ?? 'Todas as tarefas'}</h1>
      </header>
      <p className={styles.empty}>Nenhuma tarefa ainda.</p>
    </div>
  );
}
