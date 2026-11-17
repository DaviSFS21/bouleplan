import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '@/components/providers/providers';
import { calendarEvent, initiative, scheduledItem, task } from '@/test/fixtures';
import { servePlannerApi } from '@/test/planner-backend';
import { serveTaskApi } from '@/test/task-backend';
import {
  plannerKey,
  useCreateEvent,
  useCreateItem,
  useDeleteEvent,
  useDeleteItem,
  usePlanner,
  useTaskItems,
  useUpdateEvent,
  useUpdateItem,
  weekKey,
} from './planner';
import { ApiError } from './problem';
import { tasksKey, useTasks } from './tasks';
import type { Task } from './types';

const WEEK = '2026-11-16';
const DAY = '2026-11-17';
const paint = task({ estimatedEffort: 4, deadline: '2026-11-18' });
const sand = task({ id: 'a1a1a1a1-0000-4000-8000-000000000002', title: 'Lixar' });

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  );
}

function useAll() {
  return {
    client: useQueryClient(),
    week: usePlanner(WEEK),
    tasks: useTasks(),
    createItem: useCreateItem(),
    updateItem: useUpdateItem(),
    deleteItem: useDeleteItem(),
    createEvent: useCreateEvent(),
    updateEvent: useUpdateEvent(),
    deleteEvent: useDeleteEvent(),
  };
}

async function loaded(world: Parameters<typeof servePlannerApi>[0] = {}) {
  const taskBackend = serveTaskApi({ initiatives: [initiative()], tasks: [paint, sand] });
  const backend = servePlannerApi(world, taskBackend);
  const rendered = renderHook(useAll, { wrapper });
  await waitFor(() => {
    expect(rendered.result.current.week.data).toBeDefined();
    expect(rendered.result.current.tasks.data).toBeDefined();
  });
  return { ...rendered, backend, taskBackend };
}

const items = (rendered: { result: { current: ReturnType<typeof useAll> } }) =>
  rendered.result.current.week.data?.items ?? [];
const events = (rendered: { result: { current: ReturnType<typeof useAll> } }) =>
  rendered.result.current.week.data?.events ?? [];
const taskOf = (list: Task[] | undefined, id: string) => list?.find((item) => item.id === id);
const reserved = (rendered: { result: { current: ReturnType<typeof useAll> } }, id = paint.id) =>
  taskOf(rendered.result.current.tasks.data, id);

const BLOCK = { taskId: paint.id, date: DAY, startTime: '09:00', endTime: '11:00' };

describe('reading', () => {
  it('reads a week and the blocks of a task', async () => {
    const block = scheduledItem();
    const { result } = await loaded({ items: [block], events: [calendarEvent()] });
    expect(result.current.week.data?.items).toEqual([block]);

    const task_ = renderHook(() => useTaskItems(paint.id), { wrapper });
    await waitFor(() => {
      expect(task_.result.current.data).toEqual([block]);
    });
  });
});

describe('creating a scheduled item', () => {
  it('shows a block at once, then swaps it for the one the server made and settles the sums', async () => {
    const rendered = await loaded();
    const { result, backend } = rendered;
    backend.latencyMs = 250;

    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = result.current.createItem.mutateAsync(BLOCK);
    });

    await waitFor(() => {
      expect(items(rendered)).toHaveLength(1);
    });
    expect(items(rendered)[0]?.id).toMatch(/^pending-/);
    expect(reserved(rendered)).toMatchObject({
      reservedMinutes: 120,
      reservedByDeadlineMinutes: 120,
    });

    await act(async () => {
      await promise;
    });
    await waitFor(() => {
      expect(items(rendered)[0]?.id).toMatch(/^d0000000-/);
    });
    expect(items(rendered)).toHaveLength(1);
    expect(backend.bodies).toEqual([BLOCK]);
    await waitFor(() => {
      expect(reserved(rendered)?.reservedMinutes).toBe(120);
    });
  });

  it('appends a day-list entry after the ones already there', async () => {
    const existing = scheduledItem({
      startTime: null,
      endTime: null,
      sortOrder: 3,
      taskId: sand.id,
    });
    const rendered = await loaded({ items: [existing] });

    await act(async () => {
      await rendered.result.current.createItem.mutateAsync({ taskId: paint.id, date: DAY });
    });

    expect(items(rendered).map((item) => item.sortOrder)).toEqual([3, 4]);
    expect(reserved(rendered)?.reservedMinutes).toBe(0);
  });

  it('does not count a block after the deadline by the deadline', async () => {
    const rendered = await loaded();

    await act(async () => {
      await rendered.result.current.createItem.mutateAsync({
        ...BLOCK,
        date: '2026-11-19',
      });
    });

    await waitFor(() => {
      expect(reserved(rendered)).toMatchObject({
        reservedMinutes: 120,
        reservedByDeadlineMinutes: 0,
      });
    });
  });

  it('takes the block back and the sums with it when the server refuses', async () => {
    const rendered = await loaded();
    rendered.backend.failing.add('POST');

    await act(async () => {
      await expect(rendered.result.current.createItem.mutateAsync(BLOCK)).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    expect(items(rendered)).toEqual([]);
    expect(reserved(rendered)?.reservedMinutes).toBe(0);
  });

  it('rejects an overlapping block with the API code', async () => {
    const rendered = await loaded({ items: [scheduledItem({ taskId: sand.id })] });

    await act(async () => {
      await expect(
        rendered.result.current.createItem.mutateAsync({
          ...BLOCK,
          startTime: '09:30',
          endTime: '10:30',
        }),
      ).rejects.toMatchObject({ code: 'scheduled-item.overlap' });
    });
    await waitFor(() => {
      expect(items(rendered)).toHaveLength(1);
    });
  });
});

describe('updating a scheduled item', () => {
  const block = scheduledItem();

  it('moves a block at once and merges what the server answers', async () => {
    const rendered = await loaded({ items: [block] });
    rendered.backend.latencyMs = 250;
    const changes = { date: '2026-11-18', startTime: '13:00', endTime: '14:00' };

    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = rendered.result.current.updateItem.mutateAsync({ item: block, changes });
    });
    await waitFor(() => {
      expect(items(rendered)[0]).toMatchObject(changes);
    });

    await act(async () => {
      await promise;
    });
    expect(items(rendered)[0]).toMatchObject(changes);
    expect(rendered.backend.bodies).toEqual([changes]);
  });

  it('adjusts the reserved sums when the block is resized or moves past the deadline', async () => {
    const rendered = await loaded({ items: [scheduledItem({ taskId: paint.id })] });
    rendered.backend.latencyMs = 250;

    act(() => {
      void rendered.result.current.updateItem.mutateAsync({
        item: block,
        changes: { endTime: '12:00' },
      });
    });
    await waitFor(() => {
      expect(reserved(rendered)).toMatchObject({
        reservedMinutes: 180,
        reservedByDeadlineMinutes: 180,
      });
    });

    act(() => {
      void rendered.result.current.updateItem.mutateAsync({
        item: block,
        changes: { date: '2026-11-20' },
      });
    });
    await waitFor(() => {
      expect(reserved(rendered)?.reservedByDeadlineMinutes).toBe(0);
    });
    await waitFor(() => {
      expect(rendered.backend.calls).toHaveLength(2);
    });
  });

  it('turns a day-list entry into a block and back', async () => {
    const entry = scheduledItem({ startTime: null, endTime: null, sortOrder: 2 });
    const rendered = await loaded({ items: [entry] });

    await act(async () => {
      await rendered.result.current.updateItem.mutateAsync({
        item: entry,
        changes: { startTime: '09:00', endTime: '10:00' },
      });
    });
    expect(items(rendered)[0]).toMatchObject({ startTime: '09:00', sortOrder: null });

    await act(async () => {
      await rendered.result.current.updateItem.mutateAsync({
        item: items(rendered)[0] as typeof entry,
        changes: { startTime: null, endTime: null, sortOrder: 2 },
      });
    });
    expect(items(rendered)[0]).toMatchObject({ startTime: null, endTime: null, sortOrder: 2 });
  });

  it('moves a day-list entry to the end of another day', async () => {
    const entry = scheduledItem({ startTime: null, endTime: null, sortOrder: 1 });
    const other = scheduledItem({
      id: 'e0000000-0000-4000-8000-000000000002',
      taskId: sand.id,
      date: '2026-11-18',
      startTime: null,
      endTime: null,
      sortOrder: 5,
    });
    const rendered = await loaded({ items: [entry, other] });
    rendered.backend.latencyMs = 250;

    act(() => {
      void rendered.result.current.updateItem.mutateAsync({
        item: entry,
        changes: { date: '2026-11-18' },
      });
    });

    await waitFor(() => {
      expect(items(rendered).find(({ id }) => id === entry.id)).toMatchObject({
        date: '2026-11-18',
        sortOrder: 6,
      });
    });
  });

  it('puts the item back when the server refuses, keeping a later change', async () => {
    const rendered = await loaded({ items: [block] });
    rendered.backend.failing.add('PATCH');

    await act(async () => {
      await expect(
        rendered.result.current.updateItem.mutateAsync({
          item: block,
          changes: { startTime: '13:00', endTime: '14:00' },
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    expect(items(rendered)[0]).toMatchObject({ startTime: '09:00', endTime: '10:00' });
  });

  it('keeps going when the item is not in the cache any more', async () => {
    const rendered = await loaded({ items: [block] });
    rendered.result.current.client.setQueryData(weekKey(WEEK), {
      weekStart: WEEK,
      events: [],
      items: [],
    });

    await act(async () => {
      await rendered.result.current.updateItem.mutateAsync({
        item: block,
        changes: { endTime: '11:00' },
      });
    });

    await waitFor(() => {
      expect(items(rendered)[0]).toMatchObject({ endTime: '11:00' });
    });
  });
});

describe('deleting a scheduled item', () => {
  it('takes the block off at once and gives the time back', async () => {
    const block = scheduledItem({ taskId: paint.id });
    const rendered = await loaded({ items: [block] });
    rendered.backend.latencyMs = 250;
    await waitFor(() => {
      expect(reserved(rendered)?.reservedMinutes).toBe(60);
    });

    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = rendered.result.current.deleteItem.mutateAsync(block);
    });
    await waitFor(() => {
      expect(items(rendered)).toEqual([]);
    });
    expect(reserved(rendered)?.reservedMinutes).toBe(0);

    await act(async () => {
      await promise;
    });
    expect(rendered.backend.calls).toEqual([`DELETE item ${block.id}`]);
  });

  it('brings the block back when the server refuses', async () => {
    const block = scheduledItem({ taskId: paint.id });
    const rendered = await loaded({ items: [block] });
    rendered.backend.failing.add('DELETE');

    await act(async () => {
      await expect(rendered.result.current.deleteItem.mutateAsync(block)).rejects.toBeInstanceOf(
        ApiError,
      );
    });

    await waitFor(() => {
      expect(items(rendered)).toEqual([block]);
    });
    expect(reserved(rendered)?.reservedMinutes).toBe(60);
  });
});

describe('calendar events', () => {
  const daily = calendarEvent();

  it('creates an event at once and swaps it for the saved one', async () => {
    const rendered = await loaded();
    rendered.backend.latencyMs = 250;
    const body = { title: 'Reunião', date: DAY, startTime: '14:00', endTime: '15:00' };

    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = rendered.result.current.createEvent.mutateAsync(body);
    });
    await waitFor(() => {
      expect(events(rendered)).toHaveLength(1);
    });
    expect(events(rendered)[0]?.id).toMatch(/^pending-/);

    await act(async () => {
      await promise;
    });
    await waitFor(() => {
      expect(events(rendered)[0]?.id).toMatch(/^d0000000-/);
    });
    expect(events(rendered)).toHaveLength(1);
  });

  it('drops the event when creating fails', async () => {
    const rendered = await loaded();
    rendered.backend.failing.add('EVENT-POST');

    await act(async () => {
      await expect(
        rendered.result.current.createEvent.mutateAsync({
          title: 'x',
          date: DAY,
          startTime: '14:00',
          endTime: '15:00',
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    expect(events(rendered)).toEqual([]);
  });

  it('renames an event at once and merges the answer', async () => {
    const rendered = await loaded({ events: [daily] });
    rendered.backend.latencyMs = 250;

    let promise: Promise<unknown> = Promise.resolve();
    act(() => {
      promise = rendered.result.current.updateEvent.mutateAsync({
        event: daily,
        changes: { title: 'Daily do time' },
      });
    });
    await waitFor(() => {
      expect(events(rendered)[0]?.title).toBe('Daily do time');
    });
    await act(async () => {
      await promise;
    });
    expect(events(rendered)[0]?.title).toBe('Daily do time');
    expect(rendered.backend.bodies).toEqual([{ title: 'Daily do time' }]);
  });

  it('puts the old title back when renaming fails', async () => {
    const rendered = await loaded({ events: [daily] });
    rendered.backend.failing.add('EVENT-PATCH');

    await act(async () => {
      await expect(
        rendered.result.current.updateEvent.mutateAsync({
          event: daily,
          changes: { title: 'Novo' },
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    expect(events(rendered)[0]?.title).toBe('Daily');
  });

  it('still saves an event that left the cache', async () => {
    const rendered = await loaded({ events: [daily] });
    rendered.result.current.client.setQueryData(weekKey(WEEK), {
      weekStart: WEEK,
      events: [],
      items: [],
    });

    await act(async () => {
      await rendered.result.current.updateEvent.mutateAsync({
        event: daily,
        changes: { title: 'Novo' },
      });
    });

    expect(rendered.backend.events[0]?.title).toBe('Novo');
  });

  it('deletes at once and restores the event when the server refuses', async () => {
    const rendered = await loaded({ events: [daily] });

    await act(async () => {
      await rendered.result.current.deleteEvent.mutateAsync(daily);
    });
    await waitFor(() => {
      expect(events(rendered)).toEqual([]);
    });

    rendered.backend.events.push(daily);
    await act(async () => {
      await rendered.result.current.client.invalidateQueries({ queryKey: plannerKey });
    });
    rendered.backend.failing.add('EVENT-DELETE');
    await act(async () => {
      await expect(rendered.result.current.deleteEvent.mutateAsync(daily)).rejects.toBeInstanceOf(
        ApiError,
      );
    });
    await waitFor(() => {
      expect(events(rendered)).toEqual([daily]);
    });
  });
});

describe('refetching', () => {
  it('refreshes the tasks and the task blocks after a write', async () => {
    const rendered = await loaded();
    const stale = () => rendered.result.current.client.getQueryState(tasksKey)?.dataUpdatedAt;
    const before = stale();

    await act(async () => {
      await rendered.result.current.createItem.mutateAsync(BLOCK);
    });

    await waitFor(() => {
      expect(stale()).toBeGreaterThan(before ?? 0);
    });
  });
});
