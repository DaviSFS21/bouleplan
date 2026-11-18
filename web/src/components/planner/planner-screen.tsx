'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { useIsMutating } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInitiatives } from '@/api/initiatives';
import { DUPLICATE_ITEM_MESSAGE, LOAD_PLANNER_FAILED_MESSAGE } from '@/api/messages';
import { resolveId, usePlanner } from '@/api/planner';
import { useTasks } from '@/api/tasks';
import type { CalendarEvent } from '@/api/types';
import { localToday } from '@/components/deadline-field/deadline-field';
import { Icon } from '@/components/icon/icon';
import {
  EPIC_PARAM,
  SELECTION_PARAM,
  TASK_PARAM,
  WEEK_PARAM,
} from '@/components/initiatives/url-params';
import { Loading } from '@/components/loading/loading';
import { useIsBelowDesktop, useIsCoarsePointer } from '@/components/responsive/use-media-query';
import { StatusStrip } from '@/components/status-strip/status-strip';
import { TaskPanel } from '@/components/tasks/task-panel';
import { useTaskActions } from '@/components/tasks/use-task-actions';
import type { TaskPanelControl } from '@/components/tasks/task-board';
import {
  currentWeekStart,
  isoWeekNumber,
  stepWeek,
  weekDates,
  weekStartOf,
} from '@/components/tasks/task-week';
import { useMinuteClock } from '@/components/tasks/use-minute-clock';
import type { Draft } from './day-column';
import { EventPopover } from './event-popover';
import {
  KeyboardMovesContext,
  usePlannerKeyboard,
  type KeyboardMoves,
  type ReserveOrigin,
} from './keyboard-moves';
import { weekTitle } from './planner-dates';
import {
  resolveDrop,
  type DragData,
  type DropContext,
  type DropIntent,
  type Preview,
  type Resolution,
} from './planner-drop';
import { visibleHours } from './planner-geometry';
import {
  blockSpans,
  buildDays,
  weekSpans,
  type BlockModel,
  type EntryModel,
} from './planner-model';
import { RISK_FILTER, atRiskTasks, trayTasks } from './planner-tasks';
import { ReservePopover } from './reserve-popover';
import { Tray, TrayPreview } from './tray';
import { usePlannerActions } from './use-planner-actions';
import { useAddToToday } from './use-add-to-today';
import { WeekGrid } from './week-grid';
import styles from './planner-screen.module.css';

const DRAG_ACTIVATION_DISTANCE = 6;
const NO_SENSORS: SensorDescriptor<SensorOptions>[] = [];
const TRAY = '[data-planner-tray]';

function isWeekStart(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && weekStartOf(value) === value;
}

export function PlannerFallback() {
  return (
    <main className={styles.status}>
      <div role="status" aria-label="Carregando a semana">
        <Loading />
      </div>
    </main>
  );
}

export function PlannerScreen({ now }: Readonly<{ now?: Date }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clock = useMinuteClock(now);
  const today = localToday(clock);
  const requested = searchParams.get(WEEK_PARAM);
  const weekStart = isWeekStart(requested) ? requested : currentWeekStart(clock);
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  const initiativesQuery = useInitiatives();
  const tasksQuery = useTasks();
  const plannerQuery = usePlanner(weekStart);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overStrip, setOverStrip] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [popover, setPopover] = useState<{ id: string } | null>(null);
  const [reserving, setReserving] = useState<ReserveOrigin | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const pendingFocus = useRef<(() => HTMLElement | null) | null>(null);
  const keptFocus = useRef<{ selector: string; settled: boolean } | null>(null);
  const belowDesktop = useIsBelowDesktop();
  // Touch is for reading the week: moves go through the menus, and the tray is not shown.
  const coarse = useIsCoarsePointer();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
  );

  const initiatives = initiativesQuery.data;
  const listed = useMemo(() => {
    const live = new Set(initiatives?.map(({ id }) => id));
    return (tasksQuery.data ?? []).filter((task) => live.has(task.initiativeId));
  }, [tasksQuery.data, initiatives]);
  const tasksById = useMemo(() => new Map(listed.map((task) => [task.id, task])), [listed]);
  const colors = useMemo(
    () => new Map((initiatives ?? []).map(({ id, color }) => [id, color])),
    [initiatives],
  );
  const names = useMemo(
    () => new Map((initiatives ?? []).map(({ id, name }) => [id, name])),
    [initiatives],
  );

  const weekEnd = dates[6] ?? weekStart;
  const atRisk = useMemo(() => atRiskTasks(listed, today, weekEnd), [listed, today, weekEnd]);
  const atRiskIds = useMemo(() => new Set(atRisk.map(({ id }) => id)), [atRisk]);

  const days = useMemo(
    () =>
      buildDays({
        dates,
        events: plannerQuery.data?.events ?? [],
        items: plannerQuery.data?.items ?? [],
        tasks: tasksById,
        colors,
        atRisk: atRiskIds,
      }),
    [dates, plannerQuery.data, tasksById, colors, atRiskIds],
  );

  const todayIndex = dates.indexOf(today);
  const nowMinutes = todayIndex < 0 ? null : clock.getHours() * 60 + clock.getMinutes();
  const { startHour, endHour } = visibleHours(weekSpans(days), nowMinutes);

  const activeFilter =
    filter === RISK_FILTER
      ? atRisk.length > 0
        ? RISK_FILTER
        : null
      : filter !== null && names.has(filter)
        ? filter
        : null;
  const bandeja = useMemo(
    () => trayTasks(listed, weekStart, activeFilter, atRisk),
    [listed, weekStart, activeFilter, atRisk],
  );

  const taskParam = searchParams.get(TASK_PARAM);
  const openTask = taskParam ? tasksById.get(taskParam) : undefined;
  const taskWriting = useIsMutating({
    predicate: (mutation) => mutation.options.scope?.id.startsWith('task-') === true,
  });
  const settled =
    initiatives !== undefined && tasksQuery.data !== undefined && !tasksQuery.isFetching;
  const dropTaskParam =
    taskParam !== null && openTask === undefined && settled && taskWriting === 0;

  // An unknown, hidden or removed task leaves no panel and no stale link.
  useEffect(() => {
    if (!dropTaskParam) return;
    const params = new URLSearchParams(window.location.search);
    params.delete(TASK_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [dropTaskParam, router, pathname]);

  function navigate(change: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(window.location.search);
    change(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function goToWeek(next: string | null) {
    if (next === null) return;
    navigate((params) => {
      if (next === currentWeekStart(clock)) params.delete(WEEK_PARAM);
      else params.set(WEEK_PARAM, next);
    });
  }

  const taskPanel: TaskPanelControl = {
    openId: openTask?.id ?? null,
    open: (id) => {
      if (new URLSearchParams(window.location.search).get(TASK_PARAM) === id) return;
      navigate((params) => {
        params.set(TASK_PARAM, id);
      });
    },
    close: (id) => {
      if (id !== undefined && new URLSearchParams(window.location.search).get(TASK_PARAM) !== id) {
        return;
      }
      navigate((params) => {
        params.delete(TASK_PARAM);
      });
    },
    reopen: (id) => {
      if (new URLSearchParams(window.location.search).has(TASK_PARAM)) return;
      navigate((params) => {
        params.set(TASK_PARAM, id);
      });
    },
    selectPath: (initiativeId, epicId) => {
      const params = new URLSearchParams({ [SELECTION_PARAM]: initiativeId });
      if (epicId !== null) params.set(EPIC_PARAM, epicId);
      router.push(`/?${params.toString()}`);
    },
  };

  const planner = usePlannerActions({ today, report: setError });
  const todayList = useAddToToday(today, setError);
  const {
    actions: taskActions,
    panelFocus,
    focusPanel,
  } = useTaskActions({
    panel: taskPanel,
    report: setError,
    extra: {
      onAddToToday: (task) => {
        void todayList.add(task);
      },
      isInTodayList: todayList.isInToday,
    },
    focus: {
      leaving: (task) => {
        const position = bandeja.findIndex(({ id }) => id === task.id);
        const neighbour = bandeja[position + 1] ?? bandeja[position - 1];
        return () => {
          requestFocus(() =>
            document.querySelector<HTMLElement>(
              neighbour ? `${TRAY} [data-task-id="${neighbour.id}"]` : TRAY,
            ),
          );
        };
      },
    },
  });

  const openedEvent = popover
    ? plannerQuery.data?.events.find(({ id }) => id === resolveId(popover.id))
    : undefined;

  // The removed thing is already gone, so focus is lost; it goes to what is next to it.
  useEffect(() => {
    const finder = pendingFocus.current;
    if (!finder) return;
    pendingFocus.current = null;
    const lost = !document.activeElement || document.activeElement === document.body;
    const target = finder();
    if (target && lost) target.focus();
  }, [focusTick]);

  // A moved item is drawn again in its new place, so focus is lost until it is there.
  useEffect(() => {
    const kept = keptFocus.current;
    if (kept === null) return;
    const lost = !document.activeElement || document.activeElement === document.body;
    const target = lost ? document.querySelector<HTMLElement>(kept.selector) : null;
    // Once the request is over, the next draw is the last one that can need it.
    if (target || kept.settled) keptFocus.current = null;
    target?.focus();
  }, [days]);

  // A press elsewhere says where focus should be.
  useEffect(() => {
    function forget() {
      keptFocus.current = null;
    }
    document.addEventListener('pointerdown', forget, true);
    return () => {
      document.removeEventListener('pointerdown', forget, true);
    };
  }, []);

  function requestFocus(finder: () => HTMLElement | null) {
    pendingFocus.current = finder;
    setFocusTick((tick) => tick + 1);
  }

  function dayOf(date: string) {
    return days.find((day) => day.date === date);
  }

  function dropContext(): DropContext {
    return {
      startHour,
      blocksOf: (date) => {
        const day = dayOf(date);
        return day ? blockSpans(day) : [];
      },
      entriesOf: (date) => dayOf(date)?.entries.map(({ item }) => item) ?? [],
    };
  }

  function evaluate(event: DragMoveEvent | DragEndEvent): Resolution {
    const data = event.active.data.current as DragData;
    const over = event.over;
    const info = over?.data.current as { kind: 'day' | 'strip'; date: string } | undefined;
    const target =
      over && info
        ? info.kind === 'day'
          ? ({ kind: 'day', date: info.date, top: over.rect.top } as const)
          : ({ kind: 'strip', date: info.date } as const)
        : null;
    const pointerY = (event.activatorEvent as MouseEvent).clientY + event.delta.y;
    return resolveDrop(data, target, pointerY, event.delta.y, dropContext());
  }

  function apply(intent: DropIntent): Promise<void> {
    switch (intent.type) {
      case 'add-to-list':
        return planner.addToList(intent.task, intent.date);
      case 'duplicate':
        setError(DUPLICATE_ITEM_MESSAGE);
        return Promise.resolve();
      case 'move-entry':
        return planner.moveEntry(intent.item, intent.date);
      case 'reserve':
        return planner.reserve(intent.task, intent.date, intent.span);
      case 'entry-to-block':
        return planner.entryToBlock(intent.item, intent.date, intent.span);
      case 'move-block':
        return planner.moveBlock(intent.item, intent.date, intent.span);
      case 'resize':
        return planner.resizeBlock(intent.item, intent.end);
      case 'none':
      case 'blocked':
        return Promise.resolve();
    }
  }

  const keyboard = usePlannerKeyboard({
    dates,
    startHour,
    context: dropContext,
    apply,
    keepFocus: (selector) => {
      if (selector === null) {
        if (keptFocus.current) keptFocus.current.settled = true;
      } else {
        keptFocus.current = { selector, settled: false };
      }
    },
  });
  const keyboardMoves: KeyboardMoves = { ...keyboard.moves, startReserve: setReserving };

  function reserveAnchor(origin: ReserveOrigin): string {
    return origin.kind === 'tray'
      ? `${TRAY} [data-task-id="${origin.task.id}"]`
      : `[data-ficha-id="${origin.item.id}"]`;
  }

  function resetDrag() {
    setDragging(null);
    setPreview(null);
    setOverStrip(null);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setError(null);
    setDragging(active.data.current as DragData);
  }

  function handleDragMove(event: DragMoveEvent) {
    setPreview(evaluate(event).preview);
    const info = event.over?.data.current as { kind: string; date: string } | undefined;
    setOverStrip(info?.kind === 'strip' ? info.date : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { intent } = evaluate(event);
    resetDrag();
    void apply(intent);
  }

  function openFromPlanner(taskId: string, viaKeyboard = false) {
    const task = tasksById.get(taskId);
    if (task) taskActions.onOpen(task, viaKeyboard);
  }

  function nextTo<T>(list: readonly T[], found: (candidate: T) => boolean): T | undefined {
    const position = list.findIndex(found);
    return list[position + 1] ?? list[position - 1];
  }

  async function removeEntry(entry: EntryModel) {
    const date = entry.item.date;
    const next = nextTo(dayOf(date)?.entries ?? [], ({ item }) => item.id === entry.item.id);
    if (await planner.removeEntry(entry.item)) {
      requestFocus(() =>
        document.querySelector<HTMLElement>(
          next ? `[data-ficha-id="${next.item.id}"]` : `[data-strip="${date}"]`,
        ),
      );
    }
  }

  async function removeBlock(block: BlockModel) {
    const date = block.item.date;
    const next = nextTo(dayOf(date)?.blocks ?? [], ({ item }) => item.id === block.item.id);
    if (await planner.removeBlock(block.item)) {
      requestFocus(() =>
        document.querySelector<HTMLElement>(
          next ? `[data-block-id="${next.item.id}"]` : `[data-day="${date}"]`,
        ),
      );
    }
  }

  async function removeEvent(event: CalendarEvent) {
    const next = nextTo(dayOf(event.date)?.events ?? [], ({ id }) => id === event.id);
    setPopover(null);
    if (await planner.deleteEvent(event)) {
      requestFocus(() =>
        document.querySelector<HTMLElement>(
          next ? `[data-event-id="${next.id}"]` : `[data-day="${event.date}"]`,
        ),
      );
    }
  }

  function openEvent(event: CalendarEvent) {
    setPopover({ id: event.id });
  }

  function commitDraft(title: string) {
    if (!draft) return;
    const { date, span } = draft;
    setDraft(null);
    void planner.createEvent(date, span, title);
  }

  if (!initiatives || !tasksQuery.data || !plannerQuery.data) {
    const failed =
      (initiativesQuery.isError && !initiatives) ||
      (tasksQuery.isError && !tasksQuery.data) ||
      (plannerQuery.isError && !plannerQuery.data);
    if (!failed) return <PlannerFallback />;
    return (
      <main className={styles.status}>
        <p role="alert" className={styles.message}>
          {LOAD_PLANNER_FAILED_MESSAGE}
        </p>
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            void initiativesQuery.refetch();
            void tasksQuery.refetch();
            void plannerQuery.refetch();
          }}
        >
          Tentar de novo
        </button>
      </main>
    );
  }

  const previousWeek = stepWeek(weekStart, -1);
  const nextWeek = stepWeek(weekStart, 1);
  const dragged = dragging && 'task' in dragging ? dragging.task : null;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.overline}>{`Semana ${String(isoWeekNumber(weekStart))}`}</p>
          <h1 className={styles.title}>{weekTitle(weekStart)}</h1>
        </div>
        <div className={styles.controls} role="group" aria-label="Navegar entre semanas">
          <button
            type="button"
            className={styles.step}
            aria-label="Semana anterior"
            disabled={previousWeek === null}
            onClick={() => {
              goToWeek(previousWeek);
            }}
          >
            <Icon icon={ChevronLeft} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.step}
            aria-label="Próxima semana"
            disabled={nextWeek === null}
            onClick={() => {
              goToWeek(nextWeek);
            }}
          >
            <Icon icon={ChevronRight} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.today}
            onClick={() => {
              goToWeek(currentWeekStart(clock));
            }}
          >
            Hoje
          </button>
        </div>
      </header>
      <div role="status" aria-label="Alertas da semana" className={styles.alerts}>
        {atRisk.length > 0 ? (
          <StatusStrip
            tone="atencao"
            title="Prazos sem tempo reservado."
            announce={false}
            action={
              belowDesktop
                ? undefined
                : {
                    label: 'Mostrar na bandeja',
                    onClick: () => {
                      setFilter(RISK_FILTER);
                    },
                  }
            }
          >
            {atRisk.length === 1
              ? '1 tarefa vence nesta semana com tempo a reservar.'
              : `${String(atRisk.length)} tarefas vencem nesta semana com tempo a reservar.`}
          </StatusStrip>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <DndContext
        sensors={coarse ? NO_SENSORS : sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <KeyboardMovesContext value={keyboardMoves}>
          <div className={styles.body}>
            <Tray
              tasks={bandeja}
              initiatives={initiatives}
              filter={activeFilter}
              onFilter={setFilter}
              showRiskFilter={atRisk.length > 0}
              atRiskIds={atRiskIds}
              today={today}
              openTaskId={openTask?.id ?? null}
              draggingTaskId={dragging?.kind === 'tray' ? dragging.task.id : null}
              actions={{
                onOpen: openFromPlanner,
                onAddToToday: (task) => {
                  void todayList.add(task);
                },
                isInToday: todayList.isInToday,
              }}
            />
            <WeekGrid
              label={`Semana ${String(isoWeekNumber(weekStart))}`}
              today={today}
              nowMinutes={nowMinutes}
              days={days}
              startHour={startHour}
              endHour={endHour}
              preview={preview}
              draft={draft}
              dragging={dragging}
              overStrip={overStrip}
              onOpenTask={openFromPlanner}
              onRemoveEntry={(entry) => {
                void removeEntry(entry);
              }}
              onRemoveBlock={(block) => {
                void removeBlock(block);
              }}
              onOpenEvent={openEvent}
              onDraw={setDraft}
              onCommitDraft={commitDraft}
              onCancelDraft={() => {
                setDraft(null);
              }}
            />
          </div>
        </KeyboardMovesContext>
        <DragOverlay dropAnimation={null}>
          {dragged && (dragging?.kind === 'tray' || dragging?.kind === 'ficha') ? (
            <TrayPreview
              task={dragged}
              color={colors.get(dragged.initiativeId) ?? ''}
              atRisk={atRiskIds.has(dragged.id)}
              today={today}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <div role="status" aria-label="Movimentos da agenda" className={styles.announcer}>
        <span key={keyboard.announcement.id}>{keyboard.announcement.text}</span>
      </div>
      {reserving ? (
        <ReservePopover
          origin={reserving}
          dates={dates}
          initialDate={
            reserving.kind === 'ficha'
              ? reserving.item.date
              : (dates.find((date) => date === today) ?? weekStart)
          }
          anchorSelector={reserveAnchor(reserving)}
          onReserve={(date, start) => {
            const fitted = keyboard.reserve(reserving, date, start);
            if (fitted) {
              setReserving(null);
              requestFocus(() => document.querySelector<HTMLElement>(reserveAnchor(reserving)));
            }
            return fitted;
          }}
          onCancel={() => {
            const origin = reserving;
            setReserving(null);
            requestFocus(() => document.querySelector<HTMLElement>(reserveAnchor(origin)));
          }}
        />
      ) : null}
      {popover && openedEvent ? (
        <EventPopover
          event={openedEvent}
          onClose={() => {
            setPopover(null);
          }}
          onRename={(title) => {
            void planner.renameEvent(openedEvent, title);
          }}
          onDelete={() => {
            void removeEvent(openedEvent);
          }}
        />
      ) : null}
      {openTask ? (
        <TaskPanel
          task={openTask}
          tasks={listed}
          initiativeNames={names}
          actions={taskActions}
          onOpenTask={(id) => {
            taskPanel.open(id);
            focusPanel();
          }}
          focusSignal={panelFocus}
          onSelectPath={taskPanel.selectPath}
          fallbackFocus={() =>
            document.querySelector<HTMLElement>(
              `[data-task-id="${openTask.id}"], [data-block-task-id="${openTask.id}"]`,
            )
          }
          now={now}
        />
      ) : null}
    </main>
  );
}
