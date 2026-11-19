'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BLANK_EPIC_NAME_MESSAGE, createEpicMessage } from '@/api/messages';
import type { Epic } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import type { Progress } from '@/components/tasks/task-filter';
import { InlineText } from '@/components/inline-text/inline-text';
import { epicLabel } from './epic-label';
import styles from './epic-list.module.css';
import { QuickCreateField } from './quick-create-field';

const NAME_MAX_LENGTH = 200;

type EpicListProps = Readonly<{
  epics: readonly Epic[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (epic: Epic, name: string) => void;
  onArchive: (epic: Epic) => void;
  onDelete: (epic: Epic) => void;
  newEpicSignal: number;
  onNewEpicHandled: () => void;
  // undefined while the tasks load
  progress: ReadonlyMap<string, Progress> | undefined;
}>;

export function EpicList({
  epics,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onArchive,
  onDelete,
  newEpicSignal,
  onNewEpicHandled,
  progress,
}: EpicListProps) {
  const countId = useId();
  const root = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (focusTarget) {
      root.current?.querySelector<HTMLElement>(`[data-epic-id="${focusTarget.id}"]`)?.focus();
    }
  }, [focusTarget]);

  useEffect(() => {
    if (newEpicSignal > 0) onNewEpicHandled();
  }, [newEpicSignal, onNewEpicHandled]);

  function endEdit(id: string) {
    setEditingId(null);
    if (returnFocus.current) {
      returnFocus.current = false;
      setFocusTarget({ id });
    }
  }

  return (
    <div ref={root} className={styles.epics}>
      <ul className={styles.list}>
        {epics.map((epic, position) => {
          const count = progress?.get(epic.id);
          return (
            <li key={epic.id} className={styles.row}>
              {editingId === epic.id ? (
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
                    if (!event.currentTarget.contains(event.relatedTarget)) endEdit(epic.id);
                  }}
                >
                  <span>{`Épico ${String(position + 1)} ·`}</span>
                  <InlineText
                    label="Nome do épico"
                    value={epic.name}
                    maxLength={NAME_MAX_LENGTH}
                    focusSignal={1}
                    trim
                    onCommit={(name) => {
                      onRename(epic, name);
                    }}
                  />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.epic}
                    data-epic-id={epic.id}
                    aria-pressed={selectedId === epic.id}
                    aria-describedby={count ? `${countId}-${epic.id}` : undefined}
                    onClick={() => {
                      onSelect(selectedId === epic.id ? null : epic.id);
                    }}
                  >
                    {epicLabel(position, epic.name)}
                  </button>
                  {count ? (
                    <span id={`${countId}-${epic.id}`} className={styles.count}>
                      {`${String(count.done)}/${String(count.total)}`}
                    </span>
                  ) : null}
                  <div className={styles.actions}>
                    <ActionMenu
                      label={`Ações do épico ${epic.name}`}
                      items={[
                        {
                          label: 'Editar nome',
                          onSelect: () => {
                            setEditingId(epic.id);
                          },
                        },
                        { separator: true },
                        {
                          label: 'Arquivar',
                          onSelect: () => {
                            onArchive(epic);
                          },
                        },
                        {
                          label: 'Excluir',
                          onSelect: () => {
                            onDelete(epic);
                          },
                        },
                      ]}
                    />
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <QuickCreateField
        triggerLabel="+ Novo épico"
        inputLabel="Nome do novo épico"
        placeholder="Nome do épico"
        blankMessage={BLANK_EPIC_NAME_MESSAGE}
        errorMessage={createEpicMessage}
        onCreate={onCreate}
        keepOpen
        openSignal={newEpicSignal}
      />
    </div>
  );
}
