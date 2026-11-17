import { http, HttpResponse } from 'msw';
import type { Initiative, Phase, Task } from '@/api/types';
import { problemResponse } from './fixtures';
import { server } from './server';

interface World {
  initiatives: Initiative[];
  phases?: Phase[];
  tasks?: Task[];
}

export interface TaskBackend {
  initiatives: Initiative[];
  phases: Phase[];
  tasks: Task[];
  calls: string[];
  bodies: unknown[];
  // Method names (PATCH, POST, DELETE, UNDO for unarchive and restore) answered with a 500 while listed.
  failing: Set<string>;
  hiddenPhases: Set<string>;
  hiddenInitiatives: Set<string>;
  hiddenTasks: Set<string>;
}

export function serveTaskApi(world: World): TaskBackend {
  const backend: TaskBackend = {
    initiatives: world.initiatives,
    phases: world.phases ?? [],
    tasks: [...(world.tasks ?? [])],
    calls: [],
    bodies: [],
    failing: new Set(),
    hiddenPhases: new Set(),
    hiddenInitiatives: new Set(),
    hiddenTasks: new Set(),
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
  const phaseActive = (task: Task) =>
    task.phaseId === null || !backend.hiddenPhases.has(task.phaseId);

  server.use(
    http.get('*/api/initiatives', () =>
      HttpResponse.json(backend.initiatives.filter(({ id }) => !backend.hiddenInitiatives.has(id))),
    ),
    http.get('*/api/initiatives/:id/phases', ({ params }) =>
      HttpResponse.json(
        backend.phases.filter(
          (item) => item.initiativeId === params.id && !backend.hiddenPhases.has(item.id),
        ),
      ),
    ),
    http.get('*/api/tasks', () => {
      backend.calls.push('list');
      return HttpResponse.json(
        backend.tasks.filter(
          (task) =>
            !backend.hiddenTasks.has(task.id) &&
            phaseActive(task) &&
            !backend.hiddenInitiatives.has(task.initiativeId),
        ),
      );
    }),
    http.post('*/api/initiatives/:id/tasks', async ({ request, params }) => {
      const body = (await request.json()) as { title: string; phaseId?: string; status?: string };
      backend.bodies.push(body);
      if (failed('POST')) return problemResponse('internal', 500);
      if (body.title.trim() === '') return problemResponse('task.title.blank');
      created += 1;
      const task = {
        id: `c0000000-0000-4000-8000-${String(created).padStart(12, '0')}`,
        initiativeId: String(params.id),
        phaseId: body.phaseId ?? null,
        title: body.title,
        description: null,
        deadline: null,
        estimatedEffort: null,
        priority: 'P2',
        status: body.status ?? 'to_do',
        isBlocked: false,
        plannedWeekStart: null,
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
    http.post('*/api/phases/:id/archive', ({ params }) => {
      hide(backend.hiddenPhases, params.id, 'archive-phase');
      return HttpResponse.json(backend.phases.find((item) => item.id === params.id));
    }),
    http.post('*/api/phases/:id/unarchive', ({ params }) => {
      show(backend.hiddenPhases, params.id, 'unarchive-phase');
      return HttpResponse.json(backend.phases.find((item) => item.id === params.id));
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
