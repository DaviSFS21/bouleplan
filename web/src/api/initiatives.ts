import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { runScoped as runScopedMutation } from './scoped-mutation';
import { refetchTasks } from './tasks';
import type { Initiative } from './types';

const initiativesKey = ['initiatives'] as const;

export function useInitiatives() {
  return useQuery({
    queryKey: initiativesKey,
    queryFn: () => unwrap(api.GET('/initiatives')),
  });
}

export function useCreateInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => unwrap(api.POST('/initiatives', { body: { name } })),
    onSuccess: (created) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (current) =>
        current && !current.some(({ id }) => id === created.id) ? [...current, created] : current,
      );
      return queryClient.invalidateQueries({ queryKey: initiativesKey, exact: true });
    },
  });
}

export interface InitiativeChanges {
  name?: string;
  description?: string | null;
  overallDeadline?: string | null;
  color?: Initiative['color'];
}

function replaceInList(list: Initiative[] | undefined, updated: Initiative) {
  return list?.map((item) => (item.id === updated.id ? updated : item));
}

function removeFromList(list: Initiative[] | undefined, id: string) {
  return list?.filter((item) => item.id !== id);
}

function addToList(list: Initiative[] | undefined, added: Initiative) {
  return list && !list.some(({ id }) => id === added.id) ? [...list, added] : list;
}

function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  id: string,
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
): Promise<TData> {
  return runScopedMutation(
    queryClient,
    { scope: `initiative-${id}`, invalidate: initiativesKey },
    variables,
    mutationFn,
    onSuccess,
  );
}

function setList(
  queryClient: QueryClient,
  change: (list: Initiative[] | undefined) => Initiative[] | undefined,
) {
  queryClient.setQueryData<Initiative[]>(initiativesKey, change);
}

export function useUpdateInitiative() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ id, changes }: { id: string; changes: InitiativeChanges }) =>
        runScoped(
          queryClient,
          id,
          changes,
          (body) =>
            unwrap(
              api.PATCH('/initiatives/{id}', {
                params: { path: { id } },
                body,
                headers: { 'Content-Type': 'application/merge-patch+json' },
              }),
            ),
          (updated) => {
            setList(queryClient, (list) => replaceInList(list, updated));
          },
        ),
    }),
    [queryClient],
  );
}

export function useArchiveInitiative() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (id: string) =>
        runScoped(
          queryClient,
          id,
          id,
          (target) =>
            unwrap(api.POST('/initiatives/{id}/archive', { params: { path: { id: target } } })),
          (archived) => {
            setList(queryClient, (list) => removeFromList(list, archived.id));
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useUnarchiveInitiative() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (id: string) =>
        runScoped(
          queryClient,
          id,
          id,
          (target) =>
            unwrap(api.POST('/initiatives/{id}/unarchive', { params: { path: { id: target } } })),
          (restored) => {
            setList(queryClient, (list) => addToList(list, restored));
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useDeleteInitiative() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (id: string) =>
        runScoped(
          queryClient,
          id,
          id,
          async (target) => {
            await unwrap(api.DELETE('/initiatives/{id}', { params: { path: { id: target } } }));
            return target;
          },
          (deleted) => {
            setList(queryClient, (list) => removeFromList(list, deleted));
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}

export function useRestoreInitiative() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (id: string) =>
        runScoped(
          queryClient,
          id,
          id,
          (target) =>
            unwrap(api.POST('/initiatives/{id}/restore', { params: { path: { id: target } } })),
          (restored) => {
            setList(queryClient, (list) => addToList(list, restored));
            refetchTasks(queryClient);
          },
        ),
    }),
    [queryClient],
  );
}
