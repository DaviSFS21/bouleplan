import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Initiative } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { NewInitiativeField } from './new-initiative-field';
import styles from './initiative-index.module.css';

type InitiativeIndexProps = Readonly<{
  initiatives: readonly Initiative[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<string>;
  onOpenDetails: (id: string) => void;
  onEditName: (id: string) => void;
  onEditColor: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  actionError: string | null;
}>;

export function InitiativeIndex({
  initiatives,
  selectedId,
  onSelect,
  onCreate,
  onOpenDetails,
  onEditName,
  onEditColor,
  onArchive,
  onDelete,
  actionError,
}: InitiativeIndexProps) {
  const nav = useRef<HTMLElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId === null) return;
    nav.current?.querySelector<HTMLElement>(`[data-initiative-id="${focusId}"]`)?.focus();
  }, [focusId]);

  async function create(name: string) {
    setFocusId(await onCreate(name));
  }

  return (
    <nav ref={nav} className={styles.index} aria-label="Iniciativas">
      <p className={styles.title}>Iniciativas</p>
      {actionError ? (
        <p role="alert" className={styles.actionError}>
          {actionError}
        </p>
      ) : null}
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
          <li key={initiative.id} className={styles.row}>
            <button
              type="button"
              className={styles.item}
              data-initiative-id={initiative.id}
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
            <div className={styles.actions}>
              <ActionMenu
                label={`Ações de ${initiative.name}`}
                items={[
                  {
                    label: 'Abrir detalhes',
                    onSelect: () => {
                      onOpenDetails(initiative.id);
                    },
                  },
                  {
                    label: 'Editar nome',
                    onSelect: () => {
                      onEditName(initiative.id);
                    },
                  },
                  {
                    label: 'Cor…',
                    onSelect: () => {
                      onEditColor(initiative.id);
                    },
                  },
                  { separator: true },
                  {
                    label: 'Arquivar',
                    onSelect: () => {
                      onArchive(initiative.id);
                    },
                  },
                  {
                    label: 'Excluir',
                    onSelect: () => {
                      onDelete(initiative.id);
                    },
                  },
                ]}
              />
            </div>
          </li>
        ))}
      </ul>
      {initiatives.length === 0 ? (
        <p className={styles.emptyNote}>Nenhuma iniciativa ainda.</p>
      ) : null}
      <NewInitiativeField onCreate={create} />
    </nav>
  );
}
