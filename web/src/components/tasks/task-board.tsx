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
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useManyEpics } from '@/api/epics';
import { BLANK_TASK_TITLE_MESSAGE, createTaskMessage } from '@/api/messages';
import { compareTasks, useCreateTask } from '@/api/tasks';
import type { Initiative, Epic, Task, TaskStatus } from '@/api/types';
import { Loading } from '@/components/loading/loading';
import { Presence } from '@/components/motion/presence';
import { useIsCoarsePointer, useIsPhone } from '@/components/responsive/use-media-query';
import { TabStrip, tabPanelProps } from '@/components/tab-strip/tab-strip';
import { epicLabel } from '@/components/initiatives/epic-label';
import { QuickCreateField } from '@/components/initiatives/quick-create-field';
import { rememberedInitiativeId, rememberInitiativeId } from './quick-initiative';
import { useAddToToday } from '@/components/planner/use-add-to-today';
import { localToday } from '@/components/deadline-field/deadline-field';
import { useClock } from './use-clock';
import { TaskCardPreview } from './task-card';
import { useTaskActions } from './use-task-actions';
import { TaskColumn } from './task-column';
import { TaskPanel } from './task-panel';
import {
  DRAG_ACTIVATION_DISTANCE,
  KEYBOARD_CODES,
  announcements,
  columnCollision,
  columnKeyboardCoordinates,
  landingIndex,
  screenReaderInstructions,
} from './task-dnd';
import { STATUSES, statusTitle, tasksIn, visibleTasks } from './task-filter';
import styles from './task-board.module.css';

export interface TaskPanelControl {
  openId: string | null;
  open: (id: string) => void;
  // With an id, closes only while that task is the open one.
  close: (id?: string) => void;
  // Opens it again only when nothing else was opened meanwhile.
  reopen: (id: string) => void;
  selectPath: (initiativeId: string, epicId: string | null) => void;
}

interface TaskBoardProps {
  // undefined while the tasks load
  tasks: readonly Task[] | undefined;
  failed: boolean;
  onRetry: () => void;
  initiatives: readonly Initiative[];
  initiative: Initiative | null;
  epic: Epic | null;
  taskPanel: TaskPanelControl;
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
  epic,
  taskPanel,
  now,
}: Readonly<TaskBoardProps>) {
  const createTask = useCreateTask();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ task: Task; over: TaskStatus | null } | null>(null);
  const [rememberedId, setRememberedId] = useState(rememberedInitiativeId);
  const [focusTick, setFocusTick] = useState(0);
  const pendingFocus = useRef<FocusRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const phone = useIsPhone();
  // Touch scrolls and taps; moving a card goes through its menu.
  const coarse = useIsCoarsePointer();
  const [shownStatus, setShownStatus] = useState<TaskStatus>('to_do');
  const tabsPrefix = useId();
  const keyboard = useSensor(KeyboardSensor, {
    coordinateGetter: columnKeyboardCoordinates,
    keyboardCodes: KEYBOARD_CODES,
  });
  const pointer = useSensor(PointerSensor, {
    activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE },
  });
  const fineSensors = useSensors(pointer, keyboard);
  // A coarse pointer scrolls and taps; the keyboard (an iPad can have one) still moves cards.
  const touchSensors = useSensors(keyboard);
  // One column on a phone leaves nowhere to drop; moving a card goes through its menu.
  const noSensors = useSensors();
  const fineOrTouch = coarse ? touchSensors : fineSensors;
  const sensors = phone ? noSensors : fineOrTouch;

  const showPath = initiative === null;
  const epicOwners = useMemo(
    () =>
      showPath
        ? initiatives.filter(({ id }) =>
            tasks?.some((task) => task.initiativeId === id && task.epicId !== null),
          )
        : [],
    [showPath, initiatives, tasks],
  );
  const epicLists = useManyEpics(epicOwners.map(({ id }) => id));
  const epicLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const list of epicLists) {
      list?.forEach((item, position) => labels.set(item.id, epicLabel(position, item.name)));
    }
    return labels;
  }, [epicLists]);

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

  const listed = useMemo(() => {
    const live = new Set(initiatives.map(({ id }) => id));
    return (tasks ?? []).filter((task) => live.has(task.initiativeId));
  }, [tasks, initiatives]);
  const visible = useMemo(() => visibleTasks(listed, initiative, epic), [listed, initiative, epic]);
  const openTask = taskPanel.openId ? listed.find(({ id }) => id === taskPanel.openId) : undefined;
  const clock = useClock(now);
  const todayList = useAddToToday(localToday(clock), setError);
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
    const label = task.epicId === null ? undefined : epicLabels.get(task.epicId);
    return label ? `${name} › ${label}` : name;
  }

  const { actions, panelFocus, focusPanel } = useTaskActions({
    panel: taskPanel,
    report: setError,
    extra: { onAddToToday: (task) => void todayList.add(task), isInTodayList: todayList.isInToday },
    focus: {
      moved: (task, status) => {
        setShownStatus(status);
        requestFocus(task.id, status);
      },
      leaving: (task) => {
        const column = tasksIn(visible, task.status);
        const position = column.findIndex(({ id }) => id === task.id);
        const neighbour = column[position + 1] ?? column[position - 1];
        return () => {
          requestFocus(neighbour?.id ?? null, task.status);
        };
      },
      restored: (task) => {
        requestFocus(task.id, task.status);
      },
    },
  });

  function handleDragStart({ active }: DragStartEvent) {
    const task = visible.find(({ id }) => id === active.id);
    if (task) setDragging({ task, over: null });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const task = visible.find(({ id }) => id === active.id);
    if (task && over && over.id !== task.status) actions.onMove(task, over.id as TaskStatus);
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
            epicId: epic?.id,
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
        {phone ? (
          <TabStrip
            label="Estados"
            prefix={tabsPrefix}
            items={STATUSES.map((status) => {
              const label = `${statusTitle(status)} · ${String(tasksIn(visible, status).length)}`;
              return { id: status, label, content: label };
            })}
            selectedId={shownStatus}
            onSelect={(id) => {
              setShownStatus(id as TaskStatus);
            }}
            className={styles.stateTabs}
            tabClassName={styles.stateTab}
          />
        ) : null}
        <div className={styles.columns}>
          {STATUSES.filter((status) => !phone || status === shownStatus).map((status) => {
            const column = tasksIn(visible, status);
            const lands = dragging?.over === status && dragging.task.status !== status;
            return (
              <TaskColumn
                key={status}
                status={status}
                tabPanel={phone ? tabPanelProps(tabsPrefix, shownStatus) : undefined}
                tasks={column}
                pathOf={pathOf}
                colorOf={(task) => colors.get(task.initiativeId) ?? ''}
                now={clock}
                actions={actions}
                openTaskId={openTask?.id ?? null}
                slotIndex={lands ? landingIndex(column, dragging.task, compareTasks) : null}
                quickCreate={quickCreate(status)}
                draggable={!phone}
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
      <Presence>
        {openTask ? (
          <TaskPanel
            task={openTask}
            tasks={listed}
            initiativeNames={names}
            actions={actions}
            onOpenTask={(id) => {
              taskPanel.open(id);
              focusPanel();
            }}
            focusSignal={panelFocus}
            onSelectPath={taskPanel.selectPath}
            fallbackFocus={() =>
              root.current?.querySelector<HTMLElement>(`[data-task-id="${openTask.id}"]`) ?? null
            }
            now={now}
          />
        ) : null}
      </Presence>
    </div>
  );
}
