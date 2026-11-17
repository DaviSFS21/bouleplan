import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BLANK_NAME_MESSAGE, createInitiativeMessage } from '@/api/messages';
import type { Initiative, Phase, Task } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { ProgressBar } from '@/components/progress/progress-bar';
import {
  NO_PROGRESS,
  type Progress,
  progressByInitiative,
  progressByPhase,
} from '@/components/tasks/task-filter';
import { PhaseList } from './phase-list';
import { QuickCreateField } from './quick-create-field';
import styles from './initiative-index.module.css';

export interface FocusRequest {
  // null focuses "Todas as tarefas"
  id: string | null;
  phaseId?: string;
  nonce: number;
}

export interface PhaseIndexProps {
  // undefined while the phases load
  phases: readonly Phase[] | undefined;
  failed: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (phase: Phase, name: string) => void;
  onArchive: (phase: Phase) => void;
  onDelete: (phase: Phase) => void;
  newPhaseSignal: number;
  onNewPhaseHandled: () => void;
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
  onNewPhase: (id: string) => void;
  phaseIndex: PhaseIndexProps;
  // undefined while the tasks load
  tasks: readonly Task[] | undefined;
  actionError: string | null;
  focusRequest: FocusRequest | null;
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
  onNewPhase,
  phaseIndex,
  tasks,
  actionError,
  focusRequest,
}: InitiativeIndexProps) {
  const initiativeProgress = progressByInitiative(tasks);
  const phaseProgress = progressByPhase(tasks);
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
    const phase = focusRequest.phaseId
      ? root.querySelector<HTMLElement>(`[data-phase-id="${focusRequest.phaseId}"]`)
      : null;
    (phase ?? root.querySelector<HTMLElement>(initiativeSelector))?.focus();
  }, [focusRequest]);

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
                      label: 'Nova fase',
                      onSelect: () => {
                        onNewPhase(initiative.id);
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
              <PhaseSection {...phaseIndex} progress={tasks ? phaseProgress : undefined} />
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
      />
    </nav>
  );
}

function PhaseSection({
  phases,
  failed,
  ...rest
}: Readonly<PhaseIndexProps & { progress: ReadonlyMap<string, Progress> | undefined }>) {
  if (failed) {
    return <p className={styles.emptyNote}>Não foi possível carregar as fases.</p>;
  }
  if (!phases) return null;
  return <PhaseList phases={phases} {...rest} />;
}
