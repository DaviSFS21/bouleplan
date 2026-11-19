'use client';

import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import type { Task } from '@/api/types';
import { ActionMenu } from '@/components/action-menu/action-menu';
import { InlineText } from '@/components/inline-text/inline-text';
import { ITEM, LAYOUT_TRANSITION, preset } from '@/components/motion/tokens';
import { BlockedSelo, PrioritySelo } from '@/components/selo/selo';
import { deadlineLabel } from './task-deadline';
import type { DraggedTask } from './task-dnd';
import { taskMenuItems, type TaskActions } from './task-menu';
import styles from './task-card.module.css';

const TITLE_MAX_LENGTH = 300;

interface TaskCardProps {
  task: Task;
  // null hides the path: the board header already shows it
  path: string | null;
  color: string;
  now: Date;
  actions: TaskActions;
  isOpen?: boolean;
  // False when there is nowhere to drop, so no drag instructions are announced.
  draggable?: boolean;
  // Lets the list measure the card as it leaves.
  ref?: Ref<HTMLLIElement>;
}

// Pointer and key events from the menu and the title field must not open the task.
const INTERACTIVE = 'button, input, textarea, a, [role="menu"]';

function relationsLabel(task: Task): string | null {
  const parts = [
    task.blocks.length > 0 ? `bloqueia ${String(task.blocks.length)}` : null,
    task.blockedBy.length > 0 ? `esperando ${String(task.blockedBy.length)}` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
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
  const relations = relationsLabel(task);
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
      {relations ? <p className={styles.meta}>{relations}</p> : null}
    </>
  );
}

export function TaskCardPreview({
  task,
  path,
  color,
  now,
}: Readonly<Omit<TaskCardProps, 'actions' | 'isOpen' | 'draggable'>>) {
  return (
    <div
      className={[styles.card, styles.dragging].join(' ')}
      style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
    >
      <CardBody task={task} path={path} now={now} />
    </div>
  );
}

export function TaskCard({
  task,
  path,
  color,
  now,
  actions,
  isOpen = false,
  draggable = true,
  ref,
}: Readonly<TaskCardProps>) {
  const [editing, setEditing] = useState(false);
  const card = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging, active } =
    useDraggable({
      id: task.id,
      data: { task } satisfies DraggedTask,
      disabled: editing || !draggable,
    });

  function endEdit() {
    setEditing(false);
    if (returnFocus.current) {
      returnFocus.current = false;
      card.current?.focus();
    }
  }

  function startEditing() {
    setEditing(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget || editing || active) return;
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      actions.onOpen(task, true);
    } else if (
      event.key.toLowerCase() === 'e' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      startEditing();
    }
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as Element).closest(INTERACTIVE) !== null) return;
    if (isOpen) actions.onClose();
    else actions.onOpen(task);
  }

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
    // The shared id carries the card from one column to another; a card being dragged stays put.
    <motion.li
      ref={ref}
      className={styles.item}
      layout={isDragging ? false : 'position'}
      layoutId={`task-card-${task.id}`}
      transition={LAYOUT_TRANSITION}
      {...preset(ITEM)}
    >
      <article
        {...listeners}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        tabIndex={attributes.tabIndex}
        aria-describedby={draggable ? attributes['aria-describedby'] : undefined}
        aria-label={task.title}
        aria-roledescription={draggable ? 'tarefa arrastável' : undefined}
        ref={(element) => {
          card.current = element;
          setNodeRef(element);
          setActivatorNodeRef(element);
        }}
        className={[styles.card, isDragging ? styles.source : '', isOpen ? styles.open : '']
          .filter(Boolean)
          .join(' ')}
        aria-current={isOpen ? 'true' : undefined}
        style={{ '--ini': `var(--ini-${color})` } as CSSProperties}
        data-task-id={task.id}
      >
        <CardBody
          task={task}
          path={path}
          now={now}
          title={title}
          menu={
            <ActionMenu
              label={`Ações da tarefa ${task.title}`}
              items={taskMenuItems(task, actions, { onEditTitle: startEditing, withOpen: true })}
            />
          }
        />
      </article>
    </motion.li>
  );
}
