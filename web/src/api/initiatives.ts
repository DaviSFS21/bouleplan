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
