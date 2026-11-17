import type { QueryClient, QueryKey } from '@tanstack/react-query';

// A mutation scope runs mutations with the same id one after another.
export function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  target: { scope: string; invalidate: QueryKey },
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
): Promise<TData> {
  // No observer is attached, so the cache garbage-collects the mutation after gcTime.
  const mutation = queryClient
    .getMutationCache()
    .build<TData, Error, TVariables, unknown>(queryClient, {
      mutationFn,
      scope: { id: target.scope },
      onSuccess: async (data) => {
        onSuccess(data);
        await queryClient.invalidateQueries({ queryKey: target.invalidate, exact: true });
      },
    });
  return mutation.execute(variables);
}
