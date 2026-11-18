import { http, HttpResponse } from 'msw';
import type { Initiative, Epic, Task } from '@/api/types';
import { problemResponse } from './fixtures';
import { server } from './server';

interface World {
  initiatives: Initiative[];
  epics?: Epic[];
  tasks?: Task[];
}

export interface TaskBackend {
  initiatives: Initiative[];
  epics: Epic[];
  tasks: Task[];
  calls: string[];
  bodies: unknown[];
  // Method names (PATCH, POST, DELETE, UNDO for unarchive and restore, DELETE-BLOCK) answered with a 500 while listed.
  failing: Set<string>;
  hiddenEpics: Set<string>;
  hiddenInitiatives: Set<string>;
  hiddenTasks: Set<string>;
  // Problem code answered with a 422 to the next blocker PUT, once.
  blockerProblem: string | null;
}

export function serveTaskApi(world: World): TaskBackend {
  const backend: TaskBackend = {
    initiatives: world.initiatives,
    epics: world.epics ?? [],
    tasks: [...(world.tasks ?? [])],
    calls: [],
    bodies: [],
    failing: new Set(),
    hiddenEpics: new Set(),
    hiddenInitiatives: new Set(),
    hiddenTasks: new Set(),
    blockerProblem: null,
  };
  let created = 0;
  const find = (id: unknown) => backend.tasks.find((task) => task.id === id);
  const failed = (method: string) => backend.failing.has(method);
  const hide = (set: Set<string>, id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    set.add(String(id));
  };
  const show = (set: Set<string>, id: unknown, kind: string) => {
    backend.calls.push(`${kind} ${String(id)}`);
    set.delete(String(id));
  };
  const relate = (blockingId: string, blockedId: string, on: boolean) => {
    const toggle = (ids: string[], id: string) =>
      on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((other) => other !== id);
    backend.tasks = backend.tasks.map((item) => {
      if (item.id === blockingId) return { ...item, blocks: toggle(item.blocks, blockedId) };
      if (item.id === blockedId) return { ...item, blockedBy: toggle(item.blockedBy, blockingId) };
      return item;
    });
  };
  const epicActive = (task: Task) => task.epicId === null || !backend.hiddenEpics.has(task.epicId);

  server.use(
    http.get('*/api/initiatives', () =>
      HttpResponse.json(backend.initiatives.filter(({ id }) => !backend.hiddenInitiatives.has(id))),
    ),
    http.get('*/api/initiatives/:id/epics', ({ params }) =>
      HttpResponse.json(
        backend.epics.filter(
          (item) => item.initiativeId === params.id && !backend.hiddenEpics.has(item.id),
        ),
      ),
    ),
    http.get('*/api/tasks', () => {
      backend.calls.push('list');
      return HttpResponse.json(
        backend.tasks.filter(
          (task) =>
            !backend.hiddenTasks.has(task.id) &&
            epicActive(task) &&
            !backend.hiddenInitiatives.has(task.initiativeId),
        ),
      );
    }),
    http.post('*/api/initiatives/:id/tasks', async ({ request, params }) => {
      const body = (await request.json()) as { title: string; epicId?: string; status?: string };
      backend.bodies.push(body);
      if (failed('POST')) return problemResponse('internal', 500);
      if (body.title.trim() === '') return problemResponse('task.title.blank');
      created += 1;
      const task = {
        id: `c0000000-0000-4000-8000-${String(created).padStart(12, '0')}`,
        initiativeId: String(params.id),
        epicId: body.epicId ?? null,
        title: body.title,
        description: null,
        deadline: null,
        estimatedEffort: null,
        priority: 'P2',
        status: body.status ?? 'to_do',
        isBlocked: false,
        plannedWeekStart: null,
        reservedMinutes: 0,
        reservedByDeadlineMinutes: 0,
        blocks: [],
        blockedBy: [],
        createdAt: `2026-02-${String(10 + created).padStart(2, '0')}T10:00:00-03:00`,
        updatedAt: `2026-02-${String(10 + created).padStart(2, '0')}T10:00:00-03:00`,
      } as Task;
      backend.tasks.push(task);
      return HttpResponse.json(task, { status: 201 });
    }),
    http.patch('*/api/tasks/:id', async ({ request, params }) => {
      const body = (await request.json()) as Partial<Task>;
      backend.bodies.push(body);
      if (failed('PATCH')) return problemResponse('internal', 500);
      const index = backend.tasks.findIndex((task) => task.id === params.id);
      const updated = { ...backend.tasks[index], ...body } as Task;
      backend.tasks[index] = updated;
      return HttpResponse.json(updated);
    }),
    http.put('*/api/tasks/:blockingId/blocks/:blockedId', ({ params }) => {
      backend.calls.push(`block ${String(params.blockingId)} ${String(params.blockedId)}`);
      if (backend.blockerProblem) {
        const code = backend.blockerProblem;
        backend.blockerProblem = null;
        return problemResponse(code, 422);
      }
      relate(String(params.blockingId), String(params.blockedId), true);
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete('*/api/tasks/:blockingId/blocks/:blockedId', ({ params }) => {
      backend.calls.push(`unblock ${String(params.blockingId)} ${String(params.blockedId)}`);
      if (failed('DELETE-BLOCK')) return problemResponse('internal', 500);
      relate(String(params.blockingId), String(params.blockedId), false);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/tasks/:id/archive', ({ params }) => {
      if (failed('POST')) return problemResponse('internal', 500);
      hide(backend.hiddenTasks, params.id, 'archive');
      return HttpResponse.json(find(params.id));
    }),
    http.post('*/api/tasks/:id/unarchive', ({ params }) => {
      if (failed('UNDO')) return problemResponse('internal', 500);
      show(backend.hiddenTasks, params.id, 'unarchive');
      return HttpResponse.json(find(params.id));
    }),
    http.delete('*/api/tasks/:id', ({ params }) => {
      if (failed('DELETE')) return problemResponse('internal', 500);
      hide(backend.hiddenTasks, params.id, 'delete');
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/tasks/:id/restore', ({ params }) => {
      if (failed('UNDO')) return problemResponse('internal', 500);
      show(backend.hiddenTasks, params.id, 'restore');
      return HttpResponse.json(find(params.id));
    }),
    http.post('*/api/epics/:id/archive', ({ params }) => {
      hide(backend.hiddenEpics, params.id, 'archive-epic');
      return HttpResponse.json(backend.epics.find((item) => item.id === params.id));
    }),
    http.post('*/api/epics/:id/unarchive', ({ params }) => {
      show(backend.hiddenEpics, params.id, 'unarchive-epic');
      return HttpResponse.json(backend.epics.find((item) => item.id === params.id));
    }),
    http.post('*/api/initiatives/:id/archive', ({ params }) => {
      hide(backend.hiddenInitiatives, params.id, 'archive-initiative');
      return HttpResponse.json(backend.initiatives.find((item) => item.id === params.id));
    }),
    http.post('*/api/initiatives/:id/unarchive', ({ params }) => {
      show(backend.hiddenInitiatives, params.id, 'unarchive-initiative');
      return HttpResponse.json(backend.initiatives.find((item) => item.id === params.id));
    }),
  );
  return backend;
}
