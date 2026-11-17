import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { parseTime } from '@/components/planner/planner-time';
import { weekStartOf } from '@/components/tasks/task-week';
import { api, unwrap } from './client';
import { hasQueued, runScoped as runScopedMutation } from './scoped-mutation';
import { tasksKey } from './tasks';
import type {
  CalendarEvent,
  CreateCalendarEventRequest,
  CreateScheduledItemRequest,
  PlannerWeek,
  ScheduledItem,
  Task,
  UpdateCalendarEventRequest,
  UpdateScheduledItemRequest,
} from './types';

export const plannerKey = ['planner'] as const;
export const weekKey = (weekStart: string) => ['planner', weekStart] as const;
export const taskItemsKey = (taskId: string) => ['task-items', taskId] as const;

const SCOPE = 'planner';
const MERGE_PATCH = { 'Content-Type': 'application/merge-patch+json' };

export function usePlanner(weekStart: string) {
  return useQuery({
    queryKey: weekKey(weekStart),
    queryFn: () => unwrap(api.GET('/planner', { params: { query: { weekStart } } })),
  });
}

export function useTaskItems(taskId: string) {
  return useQuery({
    queryKey: taskItemsKey(taskId),
    queryFn: () =>
      unwrap(api.GET('/tasks/{id}/scheduled-items', { params: { path: { id: taskId } } })),
  });
}

function updateWeek(
  queryClient: QueryClient,
  weekStart: string,
  change: (week: PlannerWeek) => PlannerWeek,
) {
  queryClient.setQueryData<PlannerWeek>(weekKey(weekStart), (week) => (week ? change(week) : week));
}

function cachedWeeks(queryClient: QueryClient): PlannerWeek[] {
  return queryClient
    .getQueriesData<PlannerWeek>({ queryKey: plannerKey })
    .flatMap(([, week]) => (week ? [week] : []));
}

function cancelRefetches(queryClient: QueryClient) {
  // An answer to an older read must not overwrite the optimistic state.
  if (cachedWeeks(queryClient).length === 0) return;
  void queryClient.cancelQueries({ queryKey: plannerKey });
  if (queryClient.getQueryData(tasksKey)) void queryClient.cancelQueries({ queryKey: tasksKey });
}

function findItem(queryClient: QueryClient, id: string): ScheduledItem | undefined {
  return cachedWeeks(queryClient)
    .flatMap((week) => week.items)
    .find((item) => item.id === id);
}

function findEvent(queryClient: QueryClient, id: string): CalendarEvent | undefined {
  return cachedWeeks(queryClient)
    .flatMap((week) => week.events)
    .find((event) => event.id === id);
}

function itemMinutes(item: Pick<ScheduledItem, 'startTime' | 'endTime'>): number {
  return item.startTime === null || item.endTime === null
    ? 0
    : parseTime(item.endTime) - parseTime(item.startTime);
}

interface Reservation {
  total: number;
  byDeadline: number;
}

function contribution(item: ScheduledItem | null, deadline: string | null): Reservation {
  if (item === null) return { total: 0, byDeadline: 0 };
  const minutes = itemMinutes(item);
  return { total: minutes, byDeadline: deadline === null || item.date <= deadline ? minutes : 0 };
}

// The reserved minutes on the tasks follow the blocks until the refetch brings the server's sums.
function adjustReservation(
  queryClient: QueryClient,
  taskId: string,
  before: ScheduledItem | null,
  after: ScheduledItem | null,
) {
  queryClient.setQueryData<Task[]>(tasksKey, (list) =>
    list?.map((task) => {
      if (task.id !== taskId) return task;
      const was = contribution(before, task.deadline);
      const now = contribution(after, task.deadline);
      return {
        ...task,
        reservedMinutes: Math.max(0, task.reservedMinutes + now.total - was.total),
        reservedByDeadlineMinutes: Math.max(
          0,
          task.reservedByDeadlineMinutes + now.byDeadline - was.byDeadline,
        ),
      };
    }),
  );
}

function refreshReadsOfTasks(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['task-items'] });
  if (!hasQueued(queryClient, SCOPE, plannerKey)) {
    void queryClient.invalidateQueries({ queryKey: tasksKey, exact: true });
  }
}

function runPlanner<TVariables, TData>(
  queryClient: QueryClient,
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
  optimistic: { apply: (variables: TVariables) => void; rollback: (variables: TVariables) => void },
): Promise<TData> {
  return runScopedMutation(
    queryClient,
    { scope: SCOPE, invalidate: plannerKey, awaitRefetch: false, exact: false },
    variables,
    mutationFn,
    (data) => {
      onSuccess(data);
      refreshReadsOfTasks(queryClient);
    },
    {
      onMutate: (input) => {
        cancelRefetches(queryClient);
        optimistic.apply(input);
      },
      onError: (_error, input) => {
        optimistic.rollback(input);
        if (!hasQueued(queryClient, SCOPE, plannerKey)) {
          void queryClient.invalidateQueries({ queryKey: plannerKey });
        }
        refreshReadsOfTasks(queryClient);
      },
    },
  );
}

// Items and events show under a temporary id until the server answers.
export const isPending = (id: string) => id.startsWith('pending-');

let temporary = 0;

function temporaryId(): string {
  temporary += 1;
  return `pending-${String(temporary)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

// Day-list entries go to the end of the day; a block has no order.
function nextSortOrder(queryClient: QueryClient, date: string): number {
  const week = queryClient.getQueryData<PlannerWeek>(weekKey(weekStartOf(date)));
  const orders = (week?.items ?? [])
    .filter((item) => item.date === date && item.startTime === null)
    .map((item) => item.sortOrder ?? 0);
  return Math.max(0, ...orders) + 1;
}

function insertItem(queryClient: QueryClient, item: ScheduledItem) {
  updateWeek(queryClient, weekStartOf(item.date), (week) =>
    week.items.some(({ id }) => id === item.id) ? week : { ...week, items: [...week.items, item] },
  );
}

function dropItem(queryClient: QueryClient, id: string) {
  for (const week of cachedWeeks(queryClient)) {
    if (!week.items.some((item) => item.id === id)) continue;
    updateWeek(queryClient, week.weekStart, (current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }
}

// Replaces the item wherever it is cached; it may change week when its date changes.
function replaceItem(
  queryClient: QueryClient,
  id: string,
  next: (current: ScheduledItem) => ScheduledItem,
) {
  const current = findItem(queryClient, id);
  if (!current) return;
  const updated = next(current);
  dropItem(queryClient, id);
  insertItem(queryClient, updated);
}

type ItemKey = keyof UpdateScheduledItemRequest | 'sortOrder';

function optimisticItem(
  queryClient: QueryClient,
  item: ScheduledItem,
  changes: UpdateScheduledItemRequest,
): ScheduledItem {
  const merged: ScheduledItem = { ...item, ...changes, updatedAt: isoNow() };
  merged.startTime = merged.startTime ?? null;
  merged.endTime = merged.endTime ?? null;
  if (merged.startTime !== null) {
    merged.sortOrder = null;
  } else if (
    changes.sortOrder === undefined &&
    (item.startTime !== null || merged.date !== item.date)
  ) {
    merged.sortOrder = nextSortOrder(queryClient, merged.date);
  }
  return merged;
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (body: CreateScheduledItemRequest) => {
        const id = temporaryId();
        const isBlock = body.startTime !== undefined;
        const build = (): ScheduledItem => ({
          id,
          taskId: body.taskId,
          date: body.date,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          sortOrder: isBlock ? null : nextSortOrder(queryClient, body.date),
          createdAt: isoNow(),
          updatedAt: isoNow(),
        });
        return runPlanner(
          queryClient,
          body,
          (input) => unwrap(api.POST('/scheduled-items', { body: input })),
          (created) => {
            const placeholder = findItem(queryClient, id);
            dropItem(queryClient, id);
            insertItem(queryClient, created);
            if (!placeholder) adjustReservation(queryClient, created.taskId, null, created);
          },
          {
            apply: () => {
              const placeholder = build();
              insertItem(queryClient, placeholder);
              adjustReservation(queryClient, body.taskId, null, placeholder);
            },
            rollback: () => {
              const placeholder = findItem(queryClient, id);
              dropItem(queryClient, id);
              if (placeholder) adjustReservation(queryClient, body.taskId, placeholder, null);
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({
        item,
        changes,
      }: {
        item: ScheduledItem;
        changes: UpdateScheduledItemRequest;
      }) => {
        const keys = Object.keys(changes) as ItemKey[];
        let before = findItem(queryClient, item.id) ?? item;
        let applied: ScheduledItem = before;
        return runPlanner(
          queryClient,
          changes,
          (body) =>
            unwrap(
              api.PATCH('/scheduled-items/{id}', {
                params: { path: { id: item.id } },
                body,
                headers: MERGE_PATCH,
              }),
            ),
          (updated) => {
            replaceItem(queryClient, item.id, (current) => {
              const merged = { ...current, updatedAt: updated.updatedAt };
              for (const key of [...keys, 'sortOrder'] as ItemKey[]) {
                Object.assign(merged, { [key]: updated[key] });
              }
              return merged;
            });
          },
          {
            apply: (body) => {
              before = findItem(queryClient, item.id) ?? before;
              applied = optimisticItem(queryClient, before, body);
              replaceItem(queryClient, item.id, () => applied);
              adjustReservation(queryClient, item.taskId, before, applied);
            },
            rollback: () => {
              replaceItem(queryClient, item.id, (current) => {
                const restored = { ...current };
                for (const key of [...keys, 'sortOrder'] as ItemKey[]) {
                  // A later queued change may own the field by now.
                  if (current[key] === applied[key])
                    Object.assign(restored, { [key]: before[key] });
                }
                return restored;
              });
              adjustReservation(queryClient, item.taskId, applied, before);
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (item: ScheduledItem) => {
        let removed = findItem(queryClient, item.id) ?? item;
        return runPlanner(
          queryClient,
          item.id,
          async (id) => {
            await unwrap(api.DELETE('/scheduled-items/{id}', { params: { path: { id } } }));
          },
          () => undefined,
          {
            apply: () => {
              removed = findItem(queryClient, item.id) ?? removed;
              dropItem(queryClient, item.id);
              adjustReservation(queryClient, item.taskId, removed, null);
            },
            rollback: () => {
              insertItem(queryClient, removed);
              adjustReservation(queryClient, item.taskId, null, removed);
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

function insertEvent(queryClient: QueryClient, event: CalendarEvent) {
  updateWeek(queryClient, weekStartOf(event.date), (week) =>
    week.events.some(({ id }) => id === event.id)
      ? week
      : { ...week, events: [...week.events, event] },
  );
}

function dropEvent(queryClient: QueryClient, id: string) {
  for (const week of cachedWeeks(queryClient)) {
    if (!week.events.some((event) => event.id === id)) continue;
    updateWeek(queryClient, week.weekStart, (current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== id),
    }));
  }
}

function replaceEvent(
  queryClient: QueryClient,
  id: string,
  next: (current: CalendarEvent) => CalendarEvent,
) {
  const current = findEvent(queryClient, id);
  if (!current) return;
  const updated = next(current);
  dropEvent(queryClient, id);
  insertEvent(queryClient, updated);
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (body: CreateCalendarEventRequest) => {
        const id = temporaryId();
        return runPlanner(
          queryClient,
          body,
          (input) => unwrap(api.POST('/calendar-events', { body: input })),
          (created) => {
            dropEvent(queryClient, id);
            insertEvent(queryClient, created);
          },
          {
            apply: (input) => {
              insertEvent(queryClient, { ...input, id, createdAt: isoNow(), updatedAt: isoNow() });
            },
            rollback: () => {
              dropEvent(queryClient, id);
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

type EventKey = keyof UpdateCalendarEventRequest;

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({
        event,
        changes,
      }: {
        event: CalendarEvent;
        changes: UpdateCalendarEventRequest;
      }) => {
        const keys = Object.keys(changes) as EventKey[];
        const before = findEvent(queryClient, event.id) ?? event;
        return runPlanner(
          queryClient,
          changes,
          (body) =>
            unwrap(
              api.PATCH('/calendar-events/{id}', {
                params: { path: { id: event.id } },
                body,
                headers: MERGE_PATCH,
              }),
            ),
          (updated) => {
            replaceEvent(queryClient, event.id, (current) => {
              const merged = { ...current, updatedAt: updated.updatedAt };
              for (const key of keys) Object.assign(merged, { [key]: updated[key] });
              return merged;
            });
          },
          {
            apply: (body) => {
              replaceEvent(queryClient, event.id, (current) => ({ ...current, ...body }));
            },
            rollback: (body) => {
              replaceEvent(queryClient, event.id, (current) => {
                const restored = { ...current };
                for (const key of keys) {
                  if (current[key] === body[key]) Object.assign(restored, { [key]: before[key] });
                }
                return restored;
              });
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (event: CalendarEvent) => {
        let removed = findEvent(queryClient, event.id) ?? event;
        return runPlanner(
          queryClient,
          event.id,
          async (id) => {
            await unwrap(api.DELETE('/calendar-events/{id}', { params: { path: { id } } }));
          },
          () => undefined,
          {
            apply: () => {
              removed = findEvent(queryClient, event.id) ?? removed;
              dropEvent(queryClient, event.id);
            },
            rollback: () => {
              insertEvent(queryClient, removed);
            },
          },
        );
      },
    }),
    [queryClient],
  );
}
