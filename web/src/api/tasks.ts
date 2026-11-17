import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { hasQueued, runScoped as runScopedMutation } from './scoped-mutation';
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

function cancelRefetches(queryClient: QueryClient) {
  // An answer to an older read must not overwrite the optimistic state.
  return queryClient.getQueryData(tasksKey)
    ? queryClient.cancelQueries({ queryKey: tasksKey })
    : Promise.resolve();
}

function findTask(queryClient: QueryClient, id: string) {
  return queryClient.getQueryData<Task[]>(tasksKey)?.find((item) => item.id === id);
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
    { scope, invalidate: tasksKey, awaitRefetch: false },
    variables,
    mutationFn,
    onSuccess,
    {
      onMutate: optimistic?.apply,
      onError: (_error, input) => {
        optimistic?.rollback(input);
        if (!hasQueued(queryClient, scope, tasksKey)) refetchTasks(queryClient);
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

function withChanges(list: Task[] | undefined, id: string, changes: TaskChanges) {
  return list?.map((item) => (item.id === id ? { ...item, ...changes } : item));
}

function withServerFields(list: Task[] | undefined, updated: Task, keys: (keyof TaskChanges)[]) {
  return list?.map((item) => {
    if (item.id !== updated.id) return item;
    const merged = { ...item, updatedAt: updated.updatedAt };
    for (const key of keys) Object.assign(merged, { [key]: updated[key] });
    return merged;
  });
}

function withRestored(
  list: Task[] | undefined,
  id: string,
  keys: (keyof TaskChanges)[],
  sent: TaskChanges,
  before: Task,
) {
  return list?.map((item) => {
    if (item.id !== id) return item;
    const restored = { ...item };
    for (const key of keys) {
      // A later queued change may own the field by now.
      if (item[key] === sent[key]) Object.assign(restored, { [key]: before[key] });
    }
    return restored;
  });
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
            // Only this change's fields: later queued changes are already on screen.
            setList(queryClient, (list) => withServerFields(list, updated, keys));
          },
          {
            apply: (body) => {
              void cancelRefetches(queryClient);
              setList(queryClient, (list) => withChanges(list, task.id, body));
            },
            rollback: (body) => {
              setList(queryClient, (list) => withRestored(list, task.id, keys, body, before));
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
              void cancelRefetches(queryClient);
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

interface BlockerPair {
  blockingId: string;
  blockedId: string;
}

function withRelation(
  list: Task[] | undefined,
  { blockingId, blockedId }: BlockerPair,
  on: boolean,
) {
  const toggle = (ids: string[], id: string) =>
    on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((other) => other !== id);
  return list?.map((item) => {
    if (item.id === blockingId) return { ...item, blocks: toggle(item.blocks, blockedId) };
    if (item.id === blockedId) return { ...item, blockedBy: toggle(item.blockedBy, blockingId) };
    return item;
  });
}

function useBlockerChange(method: 'PUT' | 'DELETE') {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (pair: BlockerPair) => {
        const on = method === 'PUT';
        return runScoped(
          queryClient,
          `task-${pair.blockingId}`,
          pair,
          async (input) => {
            const params = { params: { path: input } };
            await unwrap(
              on
                ? api.PUT('/tasks/{blockingId}/blocks/{blockedId}', params)
                : api.DELETE('/tasks/{blockingId}/blocks/{blockedId}', params),
            );
          },
          () => undefined,
          {
            apply: (input) => {
              void cancelRefetches(queryClient);
              setList(queryClient, (list) => withRelation(list, input, on));
            },
            rollback: (input) => {
              setList(queryClient, (list) => withRelation(list, input, !on));
            },
          },
        );
      },
    }),
    [queryClient, method],
  );
}

export function useAddBlocker() {
  return useBlockerChange('PUT');
}

export function useRemoveBlocker() {
  return useBlockerChange('DELETE');
}

const hiddenByPhase = new WeakMap<QueryClient, Map<string, Task[]>>();

// A phase that is archived or deleted takes its tasks off the board before the refetch answers.
export function hideTasksOfPhase(queryClient: QueryClient, phaseId: string) {
  const hidden = hiddenByPhase.get(queryClient) ?? new Map<string, Task[]>();
  hiddenByPhase.set(queryClient, hidden);
  const current = queryClient.getQueryData<Task[]>(tasksKey) ?? [];
  hidden.set(
    phaseId,
    current.filter((task) => task.phaseId === phaseId),
  );
  setList(queryClient, (list) => list?.filter((task) => task.phaseId !== phaseId));
}

export function showTasksOfPhase(queryClient: QueryClient, phaseId: string) {
  const back = hiddenByPhase.get(queryClient)?.get(phaseId) ?? [];
  hiddenByPhase.get(queryClient)?.delete(phaseId);
  setList(queryClient, (list) =>
    back.reduce<Task[] | undefined>((shown, task) => addToList(shown, task), list),
  );
}
