'use client';

import { CircleAlert, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { blockerMessage } from '@/api/messages';
import type { Task } from '@/api/types';
import { Icon } from '@/components/icon/icon';
import styles from './task-panel.module.css';

const MAX_OPTIONS = 8;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

interface BlockerListProps {
  label: string;
  addLabel: string;
  ids: readonly string[];
  // Visible tasks: titles of the listed ones and the candidates to add.
  tasks: readonly Task[];
  selfId: string;
  // Tasks that would only close a cycle if added here.
  exclude?: readonly string[];
  hintOf: (task: Task) => string;
  onOpen: (id: string) => void;
  onAdd: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function BlockerList({
  label,
  addLabel,
  ids,
  tasks,
  selfId,
  exclude = [],
  hintOf,
  onOpen,
  onAdd,
  onRemove,
}: Readonly<BlockerListProps>) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(new Set<string>());
  const restoreFocus = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const listed = ids.flatMap((id) => tasks.find((task) => task.id === id) ?? []);
  const wanted = normalize(query.trim());
  const options = tasks
    .filter(
      (task) =>
        task.id !== selfId &&
        !ids.includes(task.id) &&
        !exclude.includes(task.id) &&
        normalize(task.title).includes(wanted),
    )
    .slice(0, MAX_OPTIONS);
  const current = Math.min(active, options.length - 1);

  useEffect(() => {
    if (adding) {
      input.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      addButton.current?.focus();
    }
  }, [adding]);

  const activeId = options[current]?.id;
  useEffect(() => {
    if (!activeId) return;
    const element = document.getElementById(`${listboxId}-${activeId}`);
    if (element && 'scrollIntoView' in element) element.scrollIntoView({ block: 'nearest' });
  }, [activeId, listboxId]);

  function closeCombobox(returnFocus: boolean) {
    restoreFocus.current = returnFocus;
    setAdding(false);
    setQuery('');
    setActive(0);
  }

  async function run(action: () => Promise<void>, kind: 'add' | 'remove', id: string) {
    const key = `${kind}:${id}`;
    if (busy.current.has(key)) return;
    busy.current.add(key);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(blockerMessage(failure, kind));
    } finally {
      busy.current.delete(key);
    }
  }

  // The focused button must not vanish with the row, or Esc stops reaching the panel.
  function focusAround(id: string) {
    const rows = Array.from(list.current?.querySelectorAll<HTMLElement>('li') ?? []);
    const index = rows.findIndex((row) => row.dataset.taskId === id);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    const target = neighbour?.querySelector<HTMLElement>('[data-remove]') ?? addButton.current;
    target?.focus();
  }

  function choose(task: Task) {
    closeCombobox(true);
    void run(() => onAdd(task.id), 'add', task.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (options.length > 0) setActive((current + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (options.length > 0) setActive((current - 1 + options.length) % options.length);
        break;
      case 'Enter': {
        if (event.nativeEvent.isComposing) return;
        event.preventDefault();
        const option = options[current];
        if (option) choose(option);
        break;
      }
      case 'Escape':
        event.stopPropagation();
        closeCombobox(true);
        break;
    }
  }

  return (
    <div role="group" aria-label={label} className={styles.blockers}>
      {listed.length > 0 ? (
        <ul ref={list} className={styles.blockerItems}>
          {listed.map((task) => (
            <li key={task.id} data-task-id={task.id} className={styles.blockerItem}>
              <button
                type="button"
                className={styles.blockerTitle}
                onClick={() => {
                  onOpen(task.id);
                }}
              >
                {task.title}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Remover ${task.title}`}
                data-remove=""
                onClick={() => {
                  focusAround(task.id);
                  void run(() => onRemove(task.id), 'remove', task.id);
                }}
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <div className={styles.combobox}>
          <input
            ref={input}
            type="text"
            role="combobox"
            className={styles.comboInput}
            aria-label={addLabel}
            aria-expanded={options.length > 0}
            aria-controls={options.length > 0 ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              options[current] ? `${listboxId}-${options[current].id}` : undefined
            }
            placeholder="Buscar tarefa"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              closeCombobox(false);
            }}
          />
          {options.length > 0 ? (
            <ul id={listboxId} role="listbox" aria-label={addLabel} className={styles.options}>
              {options.map((task, position) => (
                <li
                  key={task.id}
                  id={`${listboxId}-${task.id}`}
                  role="option"
                  aria-selected={position === current}
                  className={styles.option}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    choose(task);
                  }}
                >
                  <span>{task.title}</span>
                  <span className={styles.optionHint}>{hintOf(task)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className={styles.comboEmpty}>
              Nenhuma tarefa encontrada.
            </p>
          )}
        </div>
      ) : (
        <button
          ref={addButton}
          type="button"
          className={styles.textButton}
          onClick={() => {
            setAdding(true);
          }}
        >
          + Adicionar
        </button>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          <Icon icon={CircleAlert} size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
