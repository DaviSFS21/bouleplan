import type { CSSProperties } from 'react';
import type { Initiative } from '@/api/types';
import { NewInitiativeField } from './new-initiative-field';
import styles from './initiative-index.module.css';

type InitiativeIndexProps = Readonly<{
  initiatives: readonly Initiative[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
}>;

export function InitiativeIndex({
  initiatives,
  selectedId,
  onSelect,
  onCreate,
}: InitiativeIndexProps) {
  return (
    <nav className={styles.index} aria-label="Iniciativas">
      <p className={styles.title}>Iniciativas</p>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={styles.item}
            aria-current={selectedId === null ? 'true' : undefined}
            onClick={() => {
              onSelect(null);
            }}
          >
            <span className={styles.name}>Todas as tarefas</span>
          </button>
        </li>
        {initiatives.map((initiative) => (
          <li key={initiative.id}>
            <button
              type="button"
              className={styles.item}
              aria-current={selectedId === initiative.id ? 'true' : undefined}
              onClick={() => {
                onSelect(initiative.id);
              }}
            >
              <span className={styles.body}>
                <span className={styles.name}>
                  <span
                    className={styles.dot}
                    style={{ '--ini': `var(--ini-${initiative.color})` } as CSSProperties}
                    aria-hidden="true"
                  />
                  {initiative.name}
                </span>
                <span className={styles.meta}>sem tarefas ainda</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {initiatives.length === 0 ? (
        <p className={styles.emptyNote}>Nenhuma iniciativa ainda.</p>
      ) : null}
      <NewInitiativeField onCreate={onCreate} />
    </nav>
  );
}
