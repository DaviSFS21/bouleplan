import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';
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
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
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

export function useUpdateInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: InitiativeChanges }) =>
      unwrap(
        api.PATCH('/initiatives/{id}', {
          params: { path: { id } },
          body: changes,
          headers: { 'Content-Type': 'application/merge-patch+json' },
        }),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (list) =>
        replaceInList(list, updated),
      );
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
    },
  });
}

export function useArchiveInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/initiatives/{id}/archive', { params: { path: { id } } })),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (list) => removeFromList(list, id));
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
    },
  });
}

export function useUnarchiveInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/initiatives/{id}/unarchive', { params: { path: { id } } })),
    onSuccess: (restored) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (list) => addToList(list, restored));
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
    },
  });
}

export function useDeleteInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await unwrap(api.DELETE('/initiatives/{id}', { params: { path: { id } } }));
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (list) => removeFromList(list, id));
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
    },
  });
}

export function useRestoreInitiative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/initiatives/{id}/restore', { params: { path: { id } } })),
    onSuccess: (restored) => {
      queryClient.setQueryData<Initiative[]>(initiativesKey, (list) => addToList(list, restored));
      return queryClient.invalidateQueries({ queryKey: initiativesKey });
    },
  });
}
