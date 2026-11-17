import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './client';

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
    // Returning the promise keeps the mutation pending until the list holds the new item.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: initiativesKey }),
  });
}
