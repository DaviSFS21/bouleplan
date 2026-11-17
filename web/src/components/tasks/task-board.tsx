'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useManyPhases } from '@/api/phases';
import {
  ARCHIVE_TASK_FAILED_MESSAGE,
  BLANK_TASK_TITLE_MESSAGE,
  DELETE_TASK_FAILED_MESSAGE,
  UNDO_FAILED_MESSAGE,
  createTaskMessage,
  updateTaskMessage,
  type TaskField,
} from '@/api/messages';
import {
  compareTasks,
  useArchiveTask,
  useCreateTask,
  useDeleteTask,
  useRestoreTask,
  useUnarchiveTask,
  useUpdateTask,
} from '@/api/tasks';
import type { Initiative, Phase, Task, TaskChanges, TaskStatus } from '@/api/types';
import { Loading } from '@/components/loading/loading';
import { useToast } from '@/components/toast/toast';
import { phaseLabel } from '@/components/initiatives/phase-label';
import { QuickCreateField } from '@/components/initiatives/quick-create-field';
import { rememberedInitiativeId, rememberInitiativeId } from './quick-initiative';
import { useClock } from './use-clock';
import { TaskCardPreview, type TaskActions } from './task-card';
import { TaskColumn } from './task-column';
import {
  DRAG_ACTIVATION_DISTANCE,
  announcements,
  columnCollision,
  columnKeyboardCoordinates,
  landingIndex,
  screenReaderInstructions,
} from './task-dnd';
import { STATUSES, statusTitle, tasksIn, visibleTasks } from './task-filter';
import styles from './task-board.module.css';

interface TaskBoardProps {
  // undefined while the tasks load
  tasks: readonly Task[] | undefined;
  failed: boolean;
  onRetry: () => void;
  initiatives: readonly Initiative[];
  initiative: Initiative | null;
  phase: Phase | null;
  now?: Date;
}

interface FocusRequest {
  taskId: string | null;
  status: TaskStatus;
}

export function TaskBoard({
  tasks,
  failed,
  onRetry,
  initiatives,
  initiative,
  phase,
  now,
}: Readonly<TaskBoardProps>) {
  const toast = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const unarchiveTask = useUnarchiveTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ task: Task; over: TaskStatus | null } | null>(null);
  const [rememberedId, setRememberedId] = useState(rememberedInitiativeId);
  const [focusTick, setFocusTick] = useState(0);
  const pendingFocus = useRef<FocusRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(new Set<string>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const showPath = initiative === null;
  const phaseOwners = useMemo(
    () =>
      showPath
        ? initiatives.filter(({ id }) =>
            tasks?.some((task) => task.initiativeId === id && task.phaseId !== null),
          )
        : [],
    [showPath, initiatives, tasks],
  );
  const phaseLists = useManyPhases(phaseOwners.map(({ id }) => id));
  const phaseLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const list of phaseLists) {
      list?.forEach((item, position) => labels.set(item.id, phaseLabel(position, item.name)));
    }
    return labels;
  }, [phaseLists]);

  // The card may still be on its way to the requested column, so the request waits for it.
  useEffect(() => {
    const request = pendingFocus.current;
    if (!request) return;
    const column = root.current?.querySelector(`[data-column="${request.status}"]`);
    const target = request.taskId
      ? column?.querySelector<HTMLElement>(`[data-task-id="${request.taskId}"]`)
      : column?.querySelector<HTMLElement>('[data-quick-create]');
    // A slow answer must not take focus from wherever the person went meanwhile.
    const lost = !document.activeElement || document.activeElement === document.body;
    if (target && lost) target.focus();
    if (target || request.taskId === null) pendingFocus.current = null;
  }, [focusTick, tasks]);

  const visible = useMemo(() => {
    const live = new Set(initiatives.map(({ id }) => id));
    const listed = (tasks ?? []).filter((task) => live.has(task.initiativeId));
    return visibleTasks(listed, initiative, phase);
  }, [tasks, initiatives, initiative, phase]);
  const clock = useClock(now);
  const colors = new Map(initiatives.map(({ id, color }) => [id, color]));
  const names = new Map(initiatives.map(({ id, name }) => [id, name]));
  const chosen = initiatives.find(({ id }) => id === rememberedId) ?? initiatives[0] ?? null;
  const target = initiative ?? chosen;

  function requestFocus(taskId: string | null, status: TaskStatus) {
    pendingFocus.current = { taskId, status };
    setFocusTick((tick) => tick + 1);
  }

  function pathOf(task: Task): string | null {
    if (!showPath) return null;
    const name = names.get(task.initiativeId) ?? '';
    const label = task.phaseId === null ? undefined : phaseLabels.get(task.phaseId);
    return label ? `${name} › ${label}` : name;
  }

  async function change(task: Task, changes: TaskChanges, field: TaskField): Promise<boolean> {
    setError(null);
    try {
      await updateTask.mutateAsync({ task, changes });
      return true;
    } catch (failure) {
      setError(updateTaskMessage(failure, field));
      return false;
    }
  }

  async function move(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    const previous = task.status;
    requestFocus(task.id, status);
    if (!(await change(task, { status }, 'status'))) {
      requestFocus(task.id, previous);
      return;
    }
    toast.show({
      message: `Tarefa movida para ${statusTitle(status)}`,
      onUndo: () => {
        requestFocus(task.id, previous);
        updateTask
          .mutateAsync({ task: { ...task, status }, changes: { status: previous } })
          .catch(() => {
            toast.show({ message: UNDO_FAILED_MESSAGE });
          });
      },
    });
  }

  async function leave(
    task: Task,
    action: (task: Task) => Promise<unknown>,
    undo: (task: Task) => Promise<unknown>,
    messages: { done: string; failed: string },
  ) {
    if (busy.current.has(task.id)) return;
    busy.current.add(task.id);
    const column = tasksIn(visible, task.status);
    const position = column.findIndex(({ id }) => id === task.id);
    const neighbour = column[position + 1] ?? column[position - 1];
    setError(null);
    try {
      await action(task);
    } catch {
      setError(messages.failed);
      return;
    } finally {
      busy.current.delete(task.id);
    }
    requestFocus(neighbour?.id ?? null, task.status);
    toast.show({
      message: messages.done,
      onUndo: () => {
        undo(task).then(
          () => {
            requestFocus(task.id, task.status);
          },
          () => {
            toast.show({ message: UNDO_FAILED_MESSAGE });
          },
        );
      },
    });
  }

  const actions: TaskActions = {
    onRename: (task, title) => {
      if (title === '') {
        setError(BLANK_TASK_TITLE_MESSAGE);
        return;
      }
      void change(task, { title }, 'title');
    },
    onPriority: (task, priority) => {
      if (task.priority !== priority) void change(task, { priority }, 'priority');
    },
    onMove: (task, status) => {
      void move(task, status);
    },
    onToggleBlocked: (task) => {
      void change(task, { isBlocked: !task.isBlocked }, 'isBlocked');
    },
    onArchive: (task) => {
      void leave(task, archiveTask.mutateAsync, unarchiveTask.mutateAsync, {
        done: 'Tarefa arquivada',
        failed: ARCHIVE_TASK_FAILED_MESSAGE,
      });
    },
    onDelete: (task) => {
      void leave(task, deleteTask.mutateAsync, restoreTask.mutateAsync, {
        done: 'Tarefa excluída',
        failed: DELETE_TASK_FAILED_MESSAGE,
      });
    },
  };

  function handleDragStart({ active }: DragStartEvent) {
    const task = visible.find(({ id }) => id === active.id);
    if (task) setDragging({ task, over: null });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const task = visible.find(({ id }) => id === active.id);
    if (task && over && over.id !== task.status) void move(task, over.id as TaskStatus);
  }

  function chooseInitiative(id: string) {
    setRememberedId(id);
    rememberInitiativeId(id);
  }

  function quickCreate(status: TaskStatus) {
    if (!target) return null;
    return (
      <QuickCreateField
        variant="task"
        keepOpen
        triggerLabel="+ Nova tarefa"
        inputLabel="Título da nova tarefa"
        placeholder="Título da tarefa"
        blankMessage={BLANK_TASK_TITLE_MESSAGE}
        errorMessage={createTaskMessage}
        maxLength={300}
        triggerData={status}
        onCreate={async (title) => {
          await createTask.mutateAsync({
            initiativeId: target.id,
            title,
            status,
            phaseId: phase?.id,
          });
          if (!initiative) chooseInitiative(target.id);
        }}
      >
        {initiative ? null : (
          <label className={styles.chooser}>
            em:
            <select
              aria-label="Iniciativa da nova tarefa"
              value={target.id}
              onChange={(event) => {
                chooseInitiative(event.target.value);
              }}
            >
              {initiatives.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </QuickCreateField>
    );
  }

  if (!tasks) {
    if (!failed) {
      return (
        <div role="status" aria-label="Carregando tarefas">
          <Loading />
        </div>
      );
    }
    return (
      <div className={styles.board}>
        <p role="alert" className={styles.status}>
          Não foi possível carregar as tarefas.
        </p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div ref={root} className={styles.board}>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={columnCollision}
        accessibility={{ announcements, screenReaderInstructions }}
        onDragStart={handleDragStart}
        onDragOver={({ over }) => {
          setDragging((current) =>
            current ? { ...current, over: (over?.id as TaskStatus | undefined) ?? null } : current,
          );
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDragging(null);
        }}
      >
        <div className={styles.columns}>
          {STATUSES.map((status) => {
            const column = tasksIn(visible, status);
            const lands = dragging?.over === status && dragging.task.status !== status;
            return (
              <TaskColumn
                key={status}
                status={status}
                tasks={column}
                pathOf={pathOf}
                colorOf={(task) => colors.get(task.initiativeId) ?? ''}
                now={clock}
                actions={actions}
                slotIndex={lands ? landingIndex(column, dragging.task, compareTasks) : null}
                quickCreate={quickCreate(status)}
              />
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <TaskCardPreview
              task={dragging.task}
              path={pathOf(dragging.task)}
              color={colors.get(dragging.task.initiativeId) ?? ''}
              now={clock}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
