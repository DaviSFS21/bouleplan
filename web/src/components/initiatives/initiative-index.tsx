import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BLANK_NAME_MESSAGE, createInitiativeMessage } from '@/api/messages';
import type { Initiative, Epic, Task } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { ProgressBar } from '@/components/progress/progress-bar';
import {
  NO_PROGRESS,
  type Progress,
  progressByInitiative,
  progressByEpic,
} from '@/components/tasks/task-filter';
import { EpicList } from './epic-list';
import { QuickCreateField } from './quick-create-field';
import styles from './initiative-index.module.css';

export interface FocusRequest {
  // null focuses "Todas as tarefas"
  id: string | null;
  epicId?: string;
  nonce: number;
}

export interface EpicIndexProps {
  // undefined while the epics load
  epics: readonly Epic[] | undefined;
  failed: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (epic: Epic, name: string) => void;
  onArchive: (epic: Epic) => void;
  onDelete: (epic: Epic) => void;
  newEpicSignal: number;
  onNewEpicHandled: () => void;
}

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
  onNewEpic: (id: string) => void;
  epicIndex: EpicIndexProps;
  // undefined while the tasks load
  tasks: readonly Task[] | undefined;
  actionError: string | null;
  focusRequest: FocusRequest | null;
  // The drawer supplies the width and the edge.
  inDrawer?: boolean;
  // Each new positive value opens the field of a new initiative and focuses it.
  createSignal?: number;
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
  onNewEpic,
  epicIndex,
  tasks,
  actionError,
  focusRequest,
  inDrawer = false,
  createSignal = 0,
}: InitiativeIndexProps) {
  const initiativeProgress = progressByInitiative(tasks);
  const epicProgress = progressByEpic(tasks);
  const nav = useRef<HTMLElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId === null) return;
    nav.current?.querySelector<HTMLElement>(`[data-initiative-id="${focusId}"]`)?.focus();
  }, [focusId]);

  useEffect(() => {
    if (!focusRequest) return;
    const root = nav.current;
    if (!root) return;
    const initiativeSelector =
      focusRequest.id === null ? '[data-all-tasks]' : `[data-initiative-id="${focusRequest.id}"]`;
    const epic = focusRequest.epicId
      ? root.querySelector<HTMLElement>(`[data-epic-id="${focusRequest.epicId}"]`)
      : null;
    (epic ?? root.querySelector<HTMLElement>(initiativeSelector))?.focus();
  }, [focusRequest]);

  async function create(name: string) {
    setFocusId(await onCreate(name));
  }

  return (
    <nav
      ref={nav}
      className={[styles.index, inDrawer ? styles.inDrawer : ''].join(' ').trim()}
      aria-label="Iniciativas"
    >
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
            data-all-tasks=""
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
            <div className={styles.row}>
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
                  {tasks ? (
                    <ProgressBar
                      label={`Progresso de ${initiative.name}`}
                      {...(initiativeProgress.get(initiative.id) ?? NO_PROGRESS)}
                    />
                  ) : null}
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
                    {
                      label: 'Novo épico',
                      onSelect: () => {
                        onNewEpic(initiative.id);
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
            </div>
            {selectedId === initiative.id ? (
              <EpicSection {...epicIndex} progress={tasks ? epicProgress : undefined} />
            ) : null}
          </li>
        ))}
      </ul>
      {initiatives.length === 0 ? (
        <p className={styles.emptyNote}>Nenhuma iniciativa ainda.</p>
      ) : null}
      <QuickCreateField
        triggerLabel="+ Nova iniciativa"
        inputLabel="Nome da nova iniciativa"
        placeholder="Nome da iniciativa"
        blankMessage={BLANK_NAME_MESSAGE}
        errorMessage={createInitiativeMessage}
        onCreate={create}
        openSignal={createSignal}
      />
    </nav>
  );
}

function EpicSection({
  epics,
  failed,
  ...rest
}: Readonly<EpicIndexProps & { progress: ReadonlyMap<string, Progress> | undefined }>) {
  if (failed) {
    return <p className={styles.emptyNote}>Não foi possível carregar os épicos.</p>;
  }
  if (!epics) return null;
  return <EpicList epics={epics} {...rest} />;
}
