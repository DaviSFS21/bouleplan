'use client';

import { useDraggable } from '@dnd-kit/core';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/api/types';
import { ActionMenu, type ActionMenuEntry } from '@/components/action-menu/action-menu';
import { InlineText } from '@/components/inline-text/inline-text';
import { BlockedSelo, PrioritySelo, seloClassName } from '@/components/selo/selo';
import { deadlineLabel } from './task-deadline';
import type { DraggedTask } from './task-dnd';
import { STATUSES, statusTitle } from './task-filter';
import styles from './task-card.module.css';

const TITLE_MAX_LENGTH = 300;
const PRIORITIES: readonly TaskPriority[] = ['P1', 'P2', 'P3'];

export interface TaskActions {
  onRename: (task: Task, title: string) => void;
  onPriority: (task: Task, priority: TaskPriority) => void;
  onMove: (task: Task, status: TaskStatus) => void;
  onToggleBlocked: (task: Task) => void;
  onArchive: (task: Task) => void;
  onDelete: (task: Task) => void;
}

interface TaskCardProps {
  task: Task;
  // null hides the path: the board header already shows it
  path: string | null;
  color: string;
  now: Date;
  actions: TaskActions;
}

interface TaskCardBodyProps {
  task: Task;
  path: string | null;
  now: Date;
  title?: ReactNode;
  menu?: ReactNode;
}

function CardBody({ task, path, now, title, menu }: Readonly<TaskCardBodyProps>) {
  const deadline = deadlineLabel(task.deadline, now, task.status === 'done');
  return (
    <>
      <div className={styles.selos}>
        <PrioritySelo priority={task.priority} />
        {task.isBlocked ? <BlockedSelo /> : null}
      </div>
      {menu ? <div className={styles.menu}>{menu}</div> : null}
      {title ?? <p className={styles.title}>{task.title}</p>}
      {task.description ? <p className={styles.description}>{task.description}</p> : null}
      {path ? <p className={styles.meta}>{path}</p> : null}
      <p className={styles.meta}>
        <span className={deadline.alert ? styles.alert : undefined}>{deadline.text}</span>
      </p>
    </>
  );
}

export function TaskCardPreview({
  task,
  path,
  color,
  now,
}: Readonly<Omit<TaskCardProps, 'actions'>>) {
  return (
    <div
      className={[styles.card, styles.dragging].join(' ')}
      style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
    >
      <CardBody task={task} path={path} now={now} />
    </div>
  );
}

export function TaskCard({ task, path, color, now, actions }: Readonly<TaskCardProps>) {
  const [editing, setEditing] = useState(false);
  const card = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task } satisfies DraggedTask,
    disabled: editing,
  });

  function endEdit() {
    setEditing(false);
    if (returnFocus.current) {
      returnFocus.current = false;
      card.current?.focus();
    }
  }

  const items: ActionMenuEntry[] = [
    {
      label: 'Editar título',
      onSelect: () => {
        setEditing(true);
      },
    },
    { separator: true },
    {
      group: 'Prioridade',
      items: PRIORITIES.map((priority) => ({
        label: priority,
        checked: task.priority === priority,
        chipClassName: seloClassName(priority),
        onSelect: () => {
          actions.onPriority(task, priority);
        },
      })),
    },
    { separator: true },
    {
      group: 'Mover para',
      items: STATUSES.map((status) => ({
        label: statusTitle(status),
        checked: task.status === status,
        onSelect: () => {
          actions.onMove(task, status);
        },
      })),
    },
    { separator: true },
    {
      label: task.isBlocked ? 'Desbloquear' : 'Marcar como bloqueada',
      onSelect: () => {
        actions.onToggleBlocked(task);
      },
    },
    { separator: true },
    {
      label: 'Arquivar',
      onSelect: () => {
        actions.onArchive(task);
      },
    },
    {
      label: 'Excluir',
      onSelect: () => {
        actions.onDelete(task);
      },
    },
  ];

  const title = editing ? (
    <div
      className={styles.editing}
      onKeyDownCapture={(event) => {
        const ends =
          event.key === 'Escape' || (event.key === 'Enter' && !event.nativeEvent.isComposing);
        if (ends) returnFocus.current = true;
      }}
      onKeyUpCapture={() => {
        returnFocus.current = false;
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) endEdit();
      }}
    >
      <InlineText
        label="Título da tarefa"
        value={task.title}
        maxLength={TITLE_MAX_LENGTH}
        focusSignal={1}
        trim
        onCommit={(next) => {
          actions.onRename(task, next);
        }}
      />
    </div>
  ) : undefined;

  return (
    <li className={styles.item}>
      <article
        {...attributes}
        {...listeners}
        role={undefined}
        aria-label={task.title}
        aria-roledescription="tarefa arrastável"
        ref={(element) => {
          card.current = element;
          setNodeRef(element);
          setActivatorNodeRef(element);
        }}
        className={isDragging ? [styles.card, styles.source].join(' ') : styles.card}
        style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
        data-task-id={task.id}
      >
        <CardBody
          task={task}
          path={path}
          now={now}
          title={title}
          menu={<ActionMenu label={`Ações da tarefa ${task.title}`} items={items} />}
        />
      </article>
    </li>
  );
}
