import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { runScoped as runScopedMutation } from './scoped-mutation';
import type { CreateTaskBody, Task, TaskChanges } from './types';

export const tasksKey = ['tasks'] as const;

export function useTasks() {
  return useQuery({
    queryKey: tasksKey,
    queryFn: () => unwrap(api.GET('/tasks')),
  });
}

// Same order as the API: priority, deadline (none last), creation, id.
export function compareTasks(a: Task, b: Task): number {
  if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
  if (a.deadline !== b.deadline) {
    if (a.deadline === null) return 1;
    if (b.deadline === null) return -1;
    return a.deadline < b.deadline ? -1 : 1;
  }
  const created = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (created !== 0) return created;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function setList(
  queryClient: QueryClient,
  change: (list: Task[] | undefined) => Task[] | undefined,
) {
  queryClient.setQueryData<Task[]>(tasksKey, change);
}

function findTask(queryClient: QueryClient, id: string) {
  return queryClient.getQueryData<Task[]>(tasksKey)?.find((item) => item.id === id);
}

function replaceInList(list: Task[] | undefined, updated: Task) {
  return list?.map((item) => (item.id === updated.id ? updated : item));
}

function addToList(list: Task[] | undefined, added: Task) {
  return list && !list.some(({ id }) => id === added.id) ? [...list, added] : list;
}

function removeFromList(list: Task[] | undefined, id: string) {
  return list?.filter((item) => item.id !== id);
}

// Archiving or deleting a phase or initiative hides its tasks, and undoing it brings them back.
export function refetchTasks(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: tasksKey, exact: true });
}

function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  scope: string,
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
  optimistic?: {
    apply: (variables: TVariables) => void;
    rollback: (variables: TVariables) => void;
  },
): Promise<TData> {
  return runScopedMutation(
    queryClient,
    { scope, invalidate: tasksKey },
    variables,
    mutationFn,
    onSuccess,
    {
      onMutate: optimistic?.apply,
      onError: (_error, input) => {
        optimistic?.rollback(input);
        refetchTasks(queryClient);
      },
    },
  );
}

export interface CreateTaskInput extends CreateTaskBody {
  initiativeId: string;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ initiativeId, ...body }: CreateTaskInput) =>
        // The initiative's own scope orders creation after its archive or delete.
        runScoped(
          queryClient,
          `initiative-${initiativeId}`,
          body,
          (input) =>
            unwrap(
              api.POST('/initiatives/{id}/tasks', {
                params: { path: { id: initiativeId } },
                body: input,
              }),
            ),
          (created) => {
            setList(queryClient, (list) => addToList(list, created));
          },
        ),
    }),
    [queryClient],
  );
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ task, changes }: { task: Task; changes: TaskChanges }) => {
        const keys = Object.keys(changes) as (keyof TaskChanges)[];
        const before = findTask(queryClient, task.id) ?? task;
        return runScoped(
          queryClient,
          `task-${task.id}`,
          changes,
          (body) =>
            unwrap(
              api.PATCH('/tasks/{id}', {
                params: { path: { id: task.id } },
                body,
                headers: { 'Content-Type': 'application/merge-patch+json' },
              }),
            ),
          (updated) => {
            setList(queryClient, (list) => replaceInList(list, updated));
          },
          {
            apply: (body) => {
              setList(queryClient, (list) =>
                list?.map((item) => (item.id === task.id ? { ...item, ...body } : item)),
              );
            },
            rollback: (body) => {
              setList(queryClient, (list) =>
                list?.map((item) => {
                  if (item.id !== task.id) return item;
                  const restored = { ...item };
                  for (const key of keys) {
                    // A later queued change may own the field by now.
                    if (item[key] === body[key]) Object.assign(restored, { [key]: before[key] });
                  }
                  return restored;
                }),
              );
            },
          },
        );
      },
    }),
    [queryClient],
  );
}

function useRemoveTask(action: (id: string) => Promise<Task | string>) {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (task: Task) => {
        let removed: Task = findTask(queryClient, task.id) ?? task;
        return runScoped(
          queryClient,
          `task-${task.id}`,
          task.id,
          action,
          () => {
            setList(queryClient, (list) => removeFromList(list, task.id));
          },
          {
            apply: () => {
              removed = findTask(queryClient, task.id) ?? removed;
              setList(queryClient, (list) => removeFromList(list, task.id));
            },
            rollback: () => {
              setList(queryClient, (list) => addToList(list, removed));
            },
          },
        );
      },
    }),
    [queryClient, action],
  );
}

const archiveRequest = (id: string) =>
  unwrap(api.POST('/tasks/{id}/archive', { params: { path: { id } } }));

const deleteRequest = async (id: string) => {
  await unwrap(api.DELETE('/tasks/{id}', { params: { path: { id } } }));
  return id;
};

export function useArchiveTask() {
  return useRemoveTask(archiveRequest);
}

export function useDeleteTask() {
  return useRemoveTask(deleteRequest);
}

function useBringBackTask(path: '/tasks/{id}/unarchive' | '/tasks/{id}/restore') {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (task: Task) =>
        runScoped(
          queryClient,
          `task-${task.id}`,
          task.id,
          (id) => unwrap(api.POST(path, { params: { path: { id } } })),
          (restored) => {
            setList(queryClient, (list) => addToList(list, restored));
          },
        ),
    }),
    [queryClient, path],
  );
}

export function useUnarchiveTask() {
  return useBringBackTask('/tasks/{id}/unarchive');
}

export function useRestoreTask() {
  return useBringBackTask('/tasks/{id}/restore');
}
