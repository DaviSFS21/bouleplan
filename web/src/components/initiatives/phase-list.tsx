'use client';

import { useEffect, useRef, useState } from 'react';
import { BLANK_PHASE_NAME_MESSAGE, createPhaseMessage } from '@/api/messages';
import type { Phase } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { InlineText } from '@/components/inline-text/inline-text';
import { phaseLabel } from './phase-label';
import styles from './phase-list.module.css';
import { QuickCreateField } from './quick-create-field';

const NAME_MAX_LENGTH = 200;

type PhaseListProps = Readonly<{
  phases: readonly Phase[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (phase: Phase, name: string) => void;
  onArchive: (phase: Phase) => void;
  onDelete: (phase: Phase) => void;
  newPhaseSignal: number;
  onNewPhaseHandled: () => void;
}>;

export function PhaseList({
  phases,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onArchive,
  onDelete,
  newPhaseSignal,
  onNewPhaseHandled,
}: PhaseListProps) {
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (focusTarget) {
      root.current?.querySelector<HTMLElement>(`[data-phase-id="${focusTarget.id}"]`)?.focus();
    }
  }, [focusTarget]);

  useEffect(() => {
    if (newPhaseSignal > 0) onNewPhaseHandled();
  }, [newPhaseSignal, onNewPhaseHandled]);

  function endEdit(id: string) {
    setEditingId(null);
    if (returnFocus.current) {
      returnFocus.current = false;
      setFocusTarget({ id });
    }
  }

  return (
    <div ref={root} className={styles.phases}>
      <ul className={styles.list}>
        {phases.map((phase, position) => (
          <li key={phase.id} className={styles.row}>
            {editingId === phase.id ? (
              <div
                className={styles.editing}
                onKeyDownCapture={(event) => {
                  const ends =
                    event.key === 'Escape' ||
                    (event.key === 'Enter' && !event.nativeEvent.isComposing);
                  if (ends) returnFocus.current = true;
                }}
                onKeyUpCapture={() => {
                  returnFocus.current = false;
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) endEdit(phase.id);
                }}
              >
                <span>{`Fase ${String(position + 1)} ·`}</span>
                <InlineText
                  label="Nome da fase"
                  value={phase.name}
                  maxLength={NAME_MAX_LENGTH}
                  focusSignal={1}
                  trim
                  onCommit={(name) => {
                    onRename(phase, name);
                  }}
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.phase}
                  data-phase-id={phase.id}
                  aria-pressed={selectedId === phase.id}
                  onClick={() => {
                    onSelect(selectedId === phase.id ? null : phase.id);
                  }}
                >
                  {phaseLabel(position, phase.name)}
                </button>
                <div className={styles.actions}>
                  <ActionMenu
                    label={`Ações da fase ${phase.name}`}
                    items={[
                      {
                        label: 'Editar nome',
                        onSelect: () => {
                          setEditingId(phase.id);
                        },
                      },
                      { separator: true },
                      {
                        label: 'Arquivar',
                        onSelect: () => {
                          onArchive(phase);
                        },
                      },
                      {
                        label: 'Excluir',
                        onSelect: () => {
                          onDelete(phase);
                        },
                      },
                    ]}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <QuickCreateField
        triggerLabel="+ Nova fase"
        inputLabel="Nome da nova fase"
        placeholder="Nome da fase"
        blankMessage={BLANK_PHASE_NAME_MESSAGE}
        errorMessage={createPhaseMessage}
        onCreate={onCreate}
        keepOpen
        openSignal={newPhaseSignal}
      />
    </div>
  );
}
