import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { runScoped as runScopedMutation } from './scoped-mutation';
import type { Phase } from './types';

export function phasesKey(initiativeId: string) {
  return ['initiatives', initiativeId, 'phases'] as const;
}

function listPhases(initiativeId: string) {
  return unwrap(api.GET('/initiatives/{id}/phases', { params: { path: { id: initiativeId } } }));
}

export function usePhases(initiativeId: string | null) {
  return useQuery({
    queryKey: phasesKey(initiativeId ?? ''),
    queryFn: () => listPhases(initiativeId ?? ''),
    enabled: initiativeId !== null,
  });
}

// Counts the phases fresh, so the answer is right even if they were never loaded; 0 on failure.
export async function fetchPhaseCount(
  queryClient: QueryClient,
  initiativeId: string,
  timeoutMs = 1500,
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Counting phases timed out'));
    }, timeoutMs);
  });
  try {
    const phases = await Promise.race([
      queryClient.query({
        queryKey: phasesKey(initiativeId),
        queryFn: () => listPhases(initiativeId),
      }),
      timeout,
    ]);
    return phases.length;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  phase: { id: string; initiativeId: string },
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
): Promise<TData> {
  return runScopedMutation(
    queryClient,
    { scope: `phase-${phase.id}`, invalidate: phasesKey(phase.initiativeId) },
    variables,
    mutationFn,
    onSuccess,
  );
}

function setList(
  queryClient: QueryClient,
  initiativeId: string,
  change: (list: Phase[] | undefined) => Phase[] | undefined,
) {
  queryClient.setQueryData<Phase[]>(phasesKey(initiativeId), change);
}

function addToList(list: Phase[] | undefined, added: Phase) {
  if (!list || list.some(({ id }) => id === added.id)) return list;
  return [...list, added].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function removeFromList(list: Phase[] | undefined, id: string) {
  return list?.filter((item) => item.id !== id);
}

export function useCreatePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ initiativeId, name }: { initiativeId: string; name: string }) =>
        // The create scope is the initiative's own, as it has no phase id yet.
        runScopedMutation(
          queryClient,
          { scope: `initiative-${initiativeId}`, invalidate: phasesKey(initiativeId) },
          name,
          (body) =>
            unwrap(
              api.POST('/initiatives/{id}/phases', {
                params: { path: { id: initiativeId } },
                body: { name: body },
              }),
            ),
          (created) => {
            setList(queryClient, initiativeId, (list) => {
              if (!list) return list;
              return list.some(({ id }) => id === created.id) ? list : [...list, created];
            });
          },
        ),
    }),
    [queryClient],
  );
}

export function useUpdatePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ phase, name }: { phase: Phase; name: string }) =>
        runScoped(
          queryClient,
          phase,
          name,
          (body) =>
            unwrap(
              api.PATCH('/phases/{id}', {
                params: { path: { id: phase.id } },
                body: { name: body },
                headers: { 'Content-Type': 'application/merge-patch+json' },
              }),
            ),
          (updated) => {
            setList(queryClient, phase.initiativeId, (list) =>
              list?.map((item) => (item.id === updated.id ? updated : item)),
            );
          },
        ),
    }),
    [queryClient],
  );
}

export function useArchivePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (phase: Phase) =>
        runScoped(
          queryClient,
          phase,
          phase.id,
          (id) => unwrap(api.POST('/phases/{id}/archive', { params: { path: { id } } })),
          (archived) => {
            setList(queryClient, phase.initiativeId, (list) => removeFromList(list, archived.id));
          },
        ),
    }),
    [queryClient],
  );
}

export function useUnarchivePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (phase: Phase) =>
        runScoped(
          queryClient,
          phase,
          phase.id,
          (id) => unwrap(api.POST('/phases/{id}/unarchive', { params: { path: { id } } })),
          (restored) => {
            setList(queryClient, phase.initiativeId, (list) => addToList(list, restored));
          },
        ),
    }),
    [queryClient],
  );
}

export function useDeletePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (phase: Phase) =>
        runScoped(
          queryClient,
          phase,
          phase.id,
          async (id) => {
            await unwrap(api.DELETE('/phases/{id}', { params: { path: { id } } }));
            return id;
          },
          (deleted) => {
            setList(queryClient, phase.initiativeId, (list) => removeFromList(list, deleted));
          },
        ),
    }),
    [queryClient],
  );
}

export function useRestorePhase() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (phase: Phase) =>
        runScoped(
          queryClient,
          phase,
          phase.id,
          (id) => unwrap(api.POST('/phases/{id}/restore', { params: { path: { id } } })),
          (restored) => {
            setList(queryClient, phase.initiativeId, (list) => addToList(list, restored));
          },
        ),
    }),
    [queryClient],
  );
}
