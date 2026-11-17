import { delay, http, HttpResponse } from 'msw';
import { parseTime } from '@/components/planner/planner-time';
import { weekDates } from '@/components/tasks/task-week';
import type { CalendarEvent, ScheduledItem } from '@/api/types';
import { problemResponse } from './fixtures';
import { server } from './server';
import type { TaskBackend } from './task-backend';

export interface PlannerBackend {
  events: CalendarEvent[];
  items: ScheduledItem[];
  // One line per write: "POST item", "PATCH item <id>", "DELETE item <id>", "POST event"...
  calls: string[];
  bodies: unknown[];
  // Names answered with a 500 while listed: POST, PATCH, DELETE, EVENT-POST, EVENT-PATCH, EVENT-DELETE.
  failing: Set<string>;
  // Answers every write after this many milliseconds.
  latencyMs: number;
}

interface World {
  events?: CalendarEvent[];
  items?: ScheduledItem[];
}

const STAMP = '2026-11-17T10:00:00-03:00';

function minutesOf(item: ScheduledItem): number {
  return item.startTime === null || item.endTime === null
    ? 0
    : parseTime(item.endTime) - parseTime(item.startTime);
}

export function servePlannerApi(world: World, tasks?: TaskBackend): PlannerBackend {
  const backend: PlannerBackend = {
    events: [...(world.events ?? [])],
    items: [...(world.items ?? [])],
    calls: [],
    bodies: [],
    failing: new Set(),
    latencyMs: 0,
  };
  let created = 0;
  const nextId = () => {
    created += 1;
    return `d0000000-0000-4000-8000-${String(created).padStart(12, '0')}`;
  };

  // The task list carries the sums, as the API computes them.
  const refreshReservations = () => {
    if (!tasks) return;
    tasks.tasks = tasks.tasks.map((task) => {
      const blocks = backend.items.filter((item) => item.taskId === task.id);
      const total = blocks.reduce((sum, item) => sum + minutesOf(item), 0);
      const byDeadline = blocks
        .filter((item) => task.deadline === null || item.date <= task.deadline)
        .reduce((sum, item) => sum + minutesOf(item), 0);
      return { ...task, reservedMinutes: total, reservedByDeadlineMinutes: byDeadline };
    });
  };
  refreshReservations();

  const conflict = (candidate: ScheduledItem) => {
    if (candidate.startTime === null) {
      return backend.items.some(
        (item) =>
          item.id !== candidate.id &&
          item.startTime === null &&
          item.taskId === candidate.taskId &&
          item.date === candidate.date,
      )
        ? problemResponse('scheduled-item.duplicate', 409)
        : null;
    }
    const start = parseTime(candidate.startTime);
    const end = parseTime(candidate.endTime ?? '00:00');
    return backend.items.some(
      (item) =>
        item.id !== candidate.id &&
        item.startTime !== null &&
        item.date === candidate.date &&
        start < parseTime(item.endTime ?? '00:00') &&
        parseTime(item.startTime) < end,
    )
      ? problemResponse('scheduled-item.overlap', 409)
      : null;
  };

  const wait = async () => {
    if (backend.latencyMs > 0) await delay(backend.latencyMs);
  };

  server.use(
    http.get('*/api/planner', ({ request }) => {
      const weekStart = new URL(request.url).searchParams.get('weekStart') ?? '';
      const days = weekDates(weekStart);
      return HttpResponse.json({
        weekStart,
        events: backend.events.filter((event) => days.includes(event.date)),
        items: backend.items.filter((item) => days.includes(item.date)),
      });
    }),
    http.get('*/api/tasks/:id/scheduled-items', ({ params }) =>
      HttpResponse.json(
        backend.items
          .filter((item) => item.taskId === params.id && item.startTime !== null)
          .sort((a, b) =>
            `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`),
          ),
      ),
    ),
    http.post('*/api/calendar-events', async ({ request }) => {
      const body = (await request.json()) as Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
      backend.bodies.push(body);
      backend.calls.push('POST event');
      await wait();
      if (backend.failing.has('EVENT-POST')) return problemResponse('internal', 500);
      if (body.title.trim() === '') return problemResponse('calendar-event.title.blank');
      const event = { ...body, id: nextId(), createdAt: STAMP, updatedAt: STAMP };
      backend.events.push(event);
      return HttpResponse.json(event, { status: 201 });
    }),
    http.patch('*/api/calendar-events/:id', async ({ request, params }) => {
      const body = (await request.json()) as Partial<CalendarEvent>;
      backend.bodies.push(body);
      backend.calls.push(`PATCH event ${String(params.id)}`);
      await wait();
      if (backend.failing.has('EVENT-PATCH')) return problemResponse('internal', 500);
      const index = backend.events.findIndex((event) => event.id === params.id);
      if (index < 0) return problemResponse('http.404', 404);
      if (body.title?.trim() === '') {
        return problemResponse('calendar-event.title.blank');
      }
      const updated = { ...backend.events[index], ...body } as CalendarEvent;
      backend.events[index] = updated;
      return HttpResponse.json(updated);
    }),
    http.delete('*/api/calendar-events/:id', async ({ params }) => {
      backend.calls.push(`DELETE event ${String(params.id)}`);
      await wait();
      if (backend.failing.has('EVENT-DELETE')) return problemResponse('internal', 500);
      if (!backend.events.some((event) => event.id === params.id)) {
        return problemResponse('http.404', 404);
      }
      backend.events = backend.events.filter((event) => event.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/scheduled-items', async ({ request }) => {
      const body = (await request.json()) as {
        taskId: string;
        date: string;
        startTime?: string;
        endTime?: string;
      };
      backend.bodies.push(body);
      backend.calls.push('POST item');
      await wait();
      if (backend.failing.has('POST')) return problemResponse('internal', 500);
      const owner = tasks?.tasks.find((task) => task.id === body.taskId);
      if (tasks && !owner) return problemResponse('http.404', 404);
      if (owner?.status === 'done') return problemResponse('scheduled-item.task-done', 422);
      const isBlock = body.startTime !== undefined;
      const lists = backend.items.filter(
        (item) => item.date === body.date && item.startTime === null,
      );
      const item: ScheduledItem = {
        id: nextId(),
        taskId: body.taskId,
        date: body.date,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        sortOrder: isBlock ? null : Math.max(-1, ...lists.map((entry) => entry.sortOrder ?? 0)) + 1,
        createdAt: STAMP,
        updatedAt: STAMP,
      };
      const refused = conflict(item);
      if (refused) return refused;
      backend.items.push(item);
      refreshReservations();
      return HttpResponse.json(item, { status: 201 });
    }),
    http.patch('*/api/scheduled-items/:id', async ({ request, params }) => {
      const body = (await request.json()) as Partial<ScheduledItem>;
      backend.bodies.push(body);
      backend.calls.push(`PATCH item ${String(params.id)}`);
      await wait();
      if (backend.failing.has('PATCH')) return problemResponse('internal', 500);
      const index = backend.items.findIndex((item) => item.id === params.id);
      const current = backend.items[index];
      if (!current) return problemResponse('http.404', 404);
      if (tasks?.tasks.find((task) => task.id === current.taskId)?.status === 'done') {
        return problemResponse('scheduled-item.task-done', 422);
      }
      const updated: ScheduledItem = { ...current, ...body };
      if (updated.startTime !== null) updated.sortOrder = null;
      else if (body.sortOrder === undefined && (current.startTime !== null || body.date)) {
        const lists = backend.items.filter(
          (item) => item.date === updated.date && item.startTime === null,
        );
        updated.sortOrder = Math.max(-1, ...lists.map((entry) => entry.sortOrder ?? 0)) + 1;
      }
      const refused = conflict(updated);
      if (refused) return refused;
      backend.items[index] = updated;
      refreshReservations();
      return HttpResponse.json(updated);
    }),
    http.delete('*/api/scheduled-items/:id', async ({ params }) => {
      backend.calls.push(`DELETE item ${String(params.id)}`);
      await wait();
      if (backend.failing.has('DELETE')) return problemResponse('internal', 500);
      if (!backend.items.some((item) => item.id === params.id)) {
        return problemResponse('http.404', 404);
      }
      backend.items = backend.items.filter((item) => item.id !== params.id);
      refreshReservations();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return backend;
}
