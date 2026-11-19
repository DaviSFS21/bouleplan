import {
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { runScoped as runScopedMutation } from './scoped-mutation';
import { hideTasksOfEpic, refetchTasks, showTasksOfEpic } from './tasks';
import type { Epic } from './types';

export function epicsKey(initiativeId: string) {
  return ['initiatives', initiativeId, 'epics'] as const;
}

function listEpics(initiativeId: string) {
  return unwrap(api.GET('/initiatives/{id}/epics', { params: { path: { id: initiativeId } } }));
}

export function useEpics(initiativeId: string | null) {
  return useQuery({
    queryKey: epicsKey(initiativeId ?? ''),
    queryFn: () => listEpics(initiativeId ?? ''),
    enabled: initiativeId !== null,
  });
}

function pickData(results: UseQueryResult<Epic[]>[]) {
  return results.map((result) => result.data);
}

// One entry per id, undefined while that initiative's epics load.
export function useManyEpics(initiativeIds: readonly string[]) {
  return useQueries({
    queries: initiativeIds.map((id) => ({
      queryKey: epicsKey(id),
      queryFn: () => listEpics(id),
    })),
    combine: pickData,
  });
}

// Counts from the cache while it is fresh, else fetches, so never-loaded epics count too; 0 on failure.
export async function fetchEpicCount(
  queryClient: QueryClient,
  initiativeId: string,
  timeoutMs = 1500,
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Counting epics timed out'));
    }, timeoutMs);
  });
  try {
    const epics = await Promise.race([
      queryClient.query({
        queryKey: epicsKey(initiativeId),
        queryFn: () => listEpics(initiativeId),
      }),
      timeout,
    ]);
    return epics.length;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  epic: { id: string; initiativeId: string },
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
): Promise<TData> {
  return runScopedMutation(
    queryClient,
    { scope: `epic-${epic.id}`, invalidate: epicsKey(epic.initiativeId) },
    variables,
    mutationFn,
    onSuccess,
  );
}

function setList(
  queryClient: QueryClient,
  initiativeId: string,
  change: (list: Epic[] | undefined) => Epic[] | undefined,
) {
  queryClient.setQueryData<Epic[]>(epicsKey(initiativeId), change);
}

function addToList(list: Epic[] | undefined, added: Epic) {
  if (!list || list.some(({ id }) => id === added.id)) return list;
  return [...list, added].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function removeFromList(list: Epic[] | undefined, id: string) {
  return list?.filter((item) => item.id !== id);
}

function withEpic(list: Epic[] | undefined, created: Epic) {
  if (!list) return list;
  return list.some(({ id }) => id === created.id) ? list : [...list, created];
}

function replaceEpic(list: Epic[] | undefined, updated: Epic) {
  return list?.map((item) => (item.id === updated.id ? updated : item));
}

export function useCreateEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ initiativeId, name }: { initiativeId: string; name: string }) =>
        // The create scope is the initiative's own, as it has no epic id yet.
        runScopedMutation(
          queryClient,
          { scope: `initiative-${initiativeId}`, invalidate: epicsKey(initiativeId) },
          name,
          (body) =>
            unwrap(
              api.POST('/initiatives/{id}/epics', {
                params: { path: { id: initiativeId } },
                body: { name: body },
              }),
            ),
          (created) => {
            setList(queryClient, initiativeId, (list) => withEpic(list, created));
          },
        ),
    }),
    [queryClient],
  );
}

export function useUpdateEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ epic, name }: { epic: Epic; name: string }) =>
        runScoped(
          queryClient,
          epic,
          name,
          (body) =>
            unwrap(
              api.PATCH('/epics/{id}', {
                params: { path: { id: epic.id } },
                body: { name: body },
                headers: { 'Content-Type': 'application/merge-patch+json' },
              }),
            ),
          (updated) => {
            setList(queryClient, epic.initiativeId, (list) => replaceEpic(list, updated));
          },
        ),
    }),
    [queryClient],
  );
}

export function useArchiveEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (epic: Epic) =>
        runScoped(
          queryClient,
          epic,
          epic.id,
          (id) => unwrap(api.POST('/epics/{id}/archive', { params: { path: { id } } })),
          (archived) => {
            setList(queryClient, epic.initiativeId, (list) => removeFromList(list, archived.id));
            hideTasksOfEpic(queryClient, epic.id);
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useUnarchiveEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (epic: Epic) =>
        runScoped(
          queryClient,
          epic,
          epic.id,
          (id) => unwrap(api.POST('/epics/{id}/unarchive', { params: { path: { id } } })),
          (restored) => {
            setList(queryClient, epic.initiativeId, (list) => addToList(list, restored));
            showTasksOfEpic(queryClient, epic.id);
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useDeleteEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (epic: Epic) =>
        runScoped(
          queryClient,
          epic,
          epic.id,
          async (id) => {
            await unwrap(api.DELETE('/epics/{id}', { params: { path: { id } } }));
            return id;
          },
          (deleted) => {
            setList(queryClient, epic.initiativeId, (list) => removeFromList(list, deleted));
            hideTasksOfEpic(queryClient, epic.id);
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useRestoreEpic() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (epic: Epic) =>
        runScoped(
          queryClient,
          epic,
          epic.id,
          (id) => unwrap(api.POST('/epics/{id}/restore', { params: { path: { id } } })),
          (restored) => {
            setList(queryClient, epic.initiativeId, (list) => addToList(list, restored));
            showTasksOfEpic(queryClient, epic.id);
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}
