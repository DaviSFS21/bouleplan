'use client';

import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { Initiative, Task } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { BlockedSelo, PrioritySelo } from '@/components/selo/selo';
import { useKeyboardMoves } from './keyboard-moves';
import { deadlineWeekday } from './planner-dates';
import type { DragData } from './planner-drop';
import { RISK_FILTER, remainingMinutes, riskLabel, trayMeta } from './planner-tasks';
import styles from './tray.module.css';

export interface TrayItemActions {
  onOpen: (taskId: string, viaKeyboard?: boolean) => void;
  onAddToToday: (task: Task) => void;
  isInToday: (task: Task) => boolean;
}

interface TrayItemProps {
  task: Task;
  color: string;
  atRisk: boolean;
  today: string;
  isOpen: boolean;
  dragging: boolean;
  actions: TrayItemActions;
}

function meta(task: Task, atRisk: boolean, today: string): { text: string; alert: boolean } {
  if (!atRisk || task.deadline === null) return { text: trayMeta(task), alert: false };
  const day = task.deadline === today ? 'hoje' : deadlineWeekday(task.deadline);
  return { text: `vence ${day} · ${riskLabel(task)}`, alert: true };
}

function TrayCard({
  task,
  atRisk,
  today,
}: Readonly<Pick<TrayItemProps, 'task' | 'atRisk' | 'today'>>) {
  const info = meta(task, atRisk, today);
  return (
    <>
      <p className={styles.title}>{task.title}</p>
      <div className={styles.line}>
        <PrioritySelo priority={task.priority} mini />
        {task.isBlocked ? <BlockedSelo mini /> : null}
        <span className={[styles.meta, info.alert ? styles.alert : ''].join(' ').trim()}>
          {info.text}
        </span>
      </div>
    </>
  );
}

export function TrayPreview(
  props: Readonly<Pick<TrayItemProps, 'task' | 'color' | 'atRisk' | 'today'>>,
) {
  return (
    <div
      className={[styles.item, styles.overlay].join(' ')}
      style={{ '--ini': `var(--ini-${props.color})` } as CSSProperties}
    >
      <TrayCard task={props.task} atRisk={props.atRisk} today={props.today} />
    </div>
  );
}

function TrayItem({
  task,
  color,
  atRisk,
  today,
  isOpen,
  dragging,
  actions,
}: Readonly<TrayItemProps>) {
  const { listeners, setNodeRef } = useDraggable({
    id: `tray:${task.id}`,
    data: { kind: 'tray', task } satisfies DragData,
  });
  const keyboard = useKeyboardMoves();
  const full = remainingMinutes(task) === 0;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (
      event.target === event.currentTarget &&
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      actions.onOpen(task.id, true);
    }
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as Element).closest('button, [role="menu"]') === null)
      actions.onOpen(task.id);
  }

  return (
    <li>
      <article
        {...listeners}
        ref={setNodeRef}
        tabIndex={0}
        aria-label={task.title}
        aria-current={isOpen ? 'true' : undefined}
        className={[
          styles.item,
          full ? styles.full : '',
          dragging ? styles.source : '',
          isOpen ? styles.open : '',
        ]
          .filter((name) => name !== '')
          .join(' ')}
        style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
        data-task-id={task.id}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <TrayCard task={task} atRisk={atRisk} today={today} />
        <div className={styles.menu}>
          <ActionMenu
            label={`Ações da tarefa ${task.title}`}
            items={[
              {
                label: 'Abrir',
                shortcut: 'Enter',
                onSelect: () => {
                  actions.onOpen(task.id, true);
                },
              },
              ...(keyboard
                ? [
                    {
                      label: 'Reservar tempo…',
                      onSelect: () => {
                        keyboard.startReserve({ kind: 'tray', task });
                      },
                    },
                  ]
                : []),
              ...(actions.isInToday(task)
                ? []
                : [
                    {
                      label: 'Pôr na lista de hoje',
                      onSelect: () => {
                        actions.onAddToToday(task);
                      },
                    },
                  ]),
            ]}
          />
        </div>
      </article>
    </li>
  );
}

interface TrayProps {
  tasks: readonly Task[];
  initiatives: readonly Initiative[];
  filter: string | null;
  onFilter: (filter: string | null) => void;
  showRiskFilter: boolean;
  atRiskIds: ReadonlySet<string>;
  today: string;
  openTaskId: string | null;
  draggingTaskId: string | null;
  actions: TrayItemActions;
}

export function Tray({
  tasks,
  initiatives,
  filter,
  onFilter,
  showRiskFilter,
  atRiskIds,
  today,
  openTaskId,
  draggingTaskId,
  actions,
}: Readonly<TrayProps>) {
  const colors = new Map(initiatives.map(({ id, color }) => [id, color]));
  return (
    <aside aria-label="Para planejar" data-planner-tray="" tabIndex={-1} className={styles.tray}>
      <h2 className={styles.heading}>Para planejar</h2>
      <div role="group" aria-label="Filtrar por iniciativa" className={styles.filter}>
        <button
          type="button"
          className={styles.pill}
          aria-pressed={filter === null}
          onClick={() => {
            onFilter(null);
          }}
        >
          Todas
        </button>
        {showRiskFilter ? (
          <button
            type="button"
            className={styles.pill}
            aria-pressed={filter === RISK_FILTER}
            onClick={() => {
              onFilter(RISK_FILTER);
            }}
          >
            Sem tempo reservado
          </button>
        ) : null}
        {initiatives.map(({ id, name, color }) => (
          <button
            key={id}
            type="button"
            className={styles.pill}
            aria-pressed={filter === id}
            onClick={() => {
              onFilter(id);
            }}
          >
            <span
              className={styles.dot}
              style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
            />
            {name}
          </button>
        ))}
      </div>
      {tasks.length === 0 ? <p className={styles.empty}>Nenhuma tarefa para planejar.</p> : null}
      <ul className={styles.list}>
        {tasks.map((task) => (
          <TrayItem
            key={task.id}
            task={task}
            color={colors.get(task.initiativeId) ?? ''}
            atRisk={atRiskIds.has(task.id)}
            today={today}
            isOpen={task.id === openTaskId}
            dragging={task.id === draggingTaskId}
            actions={actions}
          />
        ))}
      </ul>
    </aside>
  );
}
