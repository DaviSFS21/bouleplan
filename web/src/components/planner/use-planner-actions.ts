'use client';

import { useRef } from 'react';
import { UNDO_FAILED_MESSAGE, plannerMessage, type PlannerAction } from '@/api/messages';
import {
  useCreateEvent,
  useCreateItem,
  useDeleteEvent,
  useDeleteItem,
  useUpdateEvent,
  useUpdateItem,
} from '@/api/planner';
import type { CalendarEvent, ScheduledItem, Task } from '@/api/types';
import { useToast } from '@/components/toast/toast';
import { dayRow } from './planner-dates';
import type { Span } from './planner-geometry';
import { formatApiTime } from './planner-time';

export interface PlannerActions {
  addToList: (task: Task, date: string) => Promise<void>;
  moveEntry: (item: ScheduledItem, date: string) => Promise<void>;
  reserve: (task: Task, date: string, span: Span) => Promise<void>;
  entryToBlock: (item: ScheduledItem, date: string, span: Span) => Promise<void>;
  moveBlock: (item: ScheduledItem, date: string, span: Span) => Promise<void>;
  resizeBlock: (item: ScheduledItem, end: number) => Promise<void>;
  removeEntry: (item: ScheduledItem) => Promise<void>;
  removeBlock: (item: ScheduledItem) => Promise<void>;
  createEvent: (date: string, span: Span, title: string) => Promise<boolean>;
  renameEvent: (event: CalendarEvent, title: string) => Promise<void>;
  deleteEvent: (event: CalendarEvent) => Promise<void>;
}

interface Options {
  today: string;
  // null clears the last message.
  report: (message: string | null) => void;
}

function times(span: Span) {
  return { startTime: formatApiTime(span.start), endTime: formatApiTime(span.end) };
}

export function usePlannerActions({ today, report }: Options): PlannerActions {
  const toast = useToast();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const busy = useRef(new Set<string>());

  // A repeated click or drop on the same target must not send a second request.
  async function once(key: string, run: () => Promise<void>) {
    if (busy.current.has(key)) return;
    busy.current.add(key);
    try {
      await run();
    } finally {
      busy.current.delete(key);
    }
  }

  // null when the request failed and its message was reported.
  async function attempt<T>(
    action: PlannerAction,
    run: () => Promise<T>,
  ): Promise<{ value: T } | null> {
    report(null);
    try {
      return { value: await run() };
    } catch (failure) {
      report(plannerMessage(failure, action));
      return null;
    }
  }

  function offerUndo(message: string, undo: () => Promise<unknown>) {
    toast.show({
      message,
      onUndo: () => {
        undo().catch(() => {
          toast.show({ message: UNDO_FAILED_MESSAGE });
        });
      },
    });
  }

  const when = (date: string) => (date === today ? 'hoje' : dayRow(date));

  return {
    addToList: (task, date) =>
      once(`add:${task.id}:${date}`, async () => {
        const result = await attempt('add-to-list', () =>
          createItem.mutateAsync({ taskId: task.id, date }),
        );
        if (result) {
          offerUndo(`Tarefa na lista de ${when(date)}`, () => deleteItem.mutateAsync(result.value));
        }
      }),

    moveEntry: (item, date) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('move', () =>
          updateItem.mutateAsync({ item, changes: { date } }),
        );
        if (result) {
          offerUndo(`Tarefa movida para ${when(date)}`, () =>
            updateItem.mutateAsync({
              item: result.value,
              changes: { date: item.date, sortOrder: item.sortOrder },
            }),
          );
        }
      }),

    reserve: (task, date, span) =>
      once(`reserve:${task.id}:${date}:${String(span.start)}`, async () => {
        const result = await attempt('reserve', () =>
          createItem.mutateAsync({ taskId: task.id, date, ...times(span) }),
        );
        if (result) offerUndo('Tempo reservado', () => deleteItem.mutateAsync(result.value));
      }),

    entryToBlock: (item, date, span) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('reserve', () =>
          updateItem.mutateAsync({ item, changes: { ...dateChange(item, date), ...times(span) } }),
        );
        if (result) {
          offerUndo('Tempo reservado', () =>
            updateItem.mutateAsync({
              item: result.value,
              changes: {
                date: item.date,
                startTime: null,
                endTime: null,
                sortOrder: item.sortOrder,
              },
            }),
          );
        }
      }),

    moveBlock: (item, date, span) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('move', () =>
          updateItem.mutateAsync({ item, changes: { ...dateChange(item, date), ...times(span) } }),
        );
        if (result) {
          offerUndo('Tempo movido', () =>
            updateItem.mutateAsync({
              item: result.value,
              changes: { date: item.date, startTime: item.startTime, endTime: item.endTime },
            }),
          );
        }
      }),

    resizeBlock: (item, end) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('resize', () =>
          updateItem.mutateAsync({ item, changes: { endTime: formatApiTime(end) } }),
        );
        if (result) {
          offerUndo('Duração ajustada', () =>
            updateItem.mutateAsync({ item: result.value, changes: { endTime: item.endTime } }),
          );
        }
      }),

    removeEntry: (item) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('remove', () => deleteItem.mutateAsync(item));
        if (result) {
          offerUndo('Tarefa tirada da lista do dia', () =>
            createItem.mutateAsync({ taskId: item.taskId, date: item.date }),
          );
        }
      }),

    removeBlock: (item) =>
      once(`item:${item.id}`, async () => {
        const result = await attempt('remove', () => deleteItem.mutateAsync(item));
        if (result) {
          offerUndo('Tempo tirado da agenda', () =>
            createItem.mutateAsync({
              taskId: item.taskId,
              date: item.date,
              startTime: item.startTime ?? undefined,
              endTime: item.endTime ?? undefined,
            }),
          );
        }
      }),

    createEvent: async (date, span, title) => {
      const result = await attempt('create-event', () =>
        createEvent.mutateAsync({ title, date, ...times(span) }),
      );
      if (!result) return false;
      offerUndo('Compromisso criado', () => deleteEvent.mutateAsync(result.value));
      return true;
    },

    renameEvent: async (event, title) => {
      await attempt('update-event', () => updateEvent.mutateAsync({ event, changes: { title } }));
    },

    deleteEvent: (event) =>
      once(`event:${event.id}`, async () => {
        const result = await attempt('remove-event', () => deleteEvent.mutateAsync(event));
        if (result) {
          offerUndo('Compromisso excluído', () =>
            createEvent.mutateAsync({
              title: event.title,
              date: event.date,
              startTime: event.startTime,
              endTime: event.endTime,
            }),
          );
        }
      }),
  };
}

function dateChange(item: ScheduledItem, date: string) {
  return item.date === date ? {} : { date };
}
