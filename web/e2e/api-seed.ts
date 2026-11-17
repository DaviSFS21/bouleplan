import type { APIRequestContext } from '@playwright/test';

interface Created {
  id: string;
}

async function post<T>(request: APIRequestContext, path: string, data: object): Promise<T> {
  const response = await request.post(`/api${path}`, { data });
  if (!response.ok()) throw new Error(`POST ${path} answered ${String(response.status())}`);
  return (await response.json()) as T;
}

async function patch(request: APIRequestContext, path: string, data: object): Promise<void> {
  const response = await request.patch(`/api${path}`, { data });
  if (!response.ok()) throw new Error(`PATCH ${path} answered ${String(response.status())}`);
}

export interface World {
  initiativeId: string;
  taskIds: Record<string, string>;
}

interface TaskSeed {
  title: string;
  changes?: object;
}

// One initiative with tasks in every state, created through the API.
export async function seedInitiative(
  request: APIRequestContext,
  name: string,
  tasks: TaskSeed[],
): Promise<World> {
  const initiative = await post<Created>(request, '/initiatives', { name });
  const taskIds: Record<string, string> = {};
  for (const { title, changes } of tasks) {
    const task = await post<Created>(request, `/initiatives/${initiative.id}/tasks`, { title });
    if (changes) await patch(request, `/tasks/${task.id}`, changes);
    taskIds[title] = task.id;
  }
  return { initiativeId: initiative.id, taskIds };
}

export async function reserve(
  request: APIRequestContext,
  taskId: string,
  date: string,
  times?: { startTime: string; endTime: string },
): Promise<void> {
  await post(request, '/scheduled-items', { taskId, date, ...times });
}

export async function addEvent(
  request: APIRequestContext,
  event: { title: string; date: string; startTime: string; endTime: string },
): Promise<void> {
  await post(request, '/calendar-events', event);
}
