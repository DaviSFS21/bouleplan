import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query';

export interface ScopedHandlers<TVariables> {
  // Runs as soon as the mutation is queued, before it waits for earlier ones in its scope.
  onMutate?: (variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

// True when another mutation of the scope that refreshes the same key is still pending.
export function hasQueued(queryClient: QueryClient, scope: string, key: QueryKey): boolean {
  const wanted = hashKey(key);
  return (
    queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.scope?.id === scope &&
        (mutation.meta?.invalidate as QueryKey | undefined) !== undefined &&
        hashKey(mutation.meta?.invalidate as QueryKey) === wanted,
    }) > 1
  );
}

// A mutation scope runs mutations with the same id one after another.
export function runScoped<TVariables, TData>(
  queryClient: QueryClient,
  target: { scope: string; invalidate: QueryKey; awaitRefetch?: boolean },
  variables: TVariables,
  mutationFn: (variables: TVariables) => Promise<TData>,
  onSuccess: (data: TData) => void,
  handlers: ScopedHandlers<TVariables> = {},
): Promise<TData> {
  // No observer is attached, so the cache garbage-collects the mutation after gcTime.
  const mutation = queryClient
    .getMutationCache()
    .build<TData, Error, TVariables, unknown>(queryClient, {
      mutationFn,
      onMutate: (variables) => {
        handlers.onMutate?.(variables);
      },
      onError: (error, variables) => {
        handlers.onError?.(error, variables);
      },
      scope: { id: target.scope },
      meta: { invalidate: target.invalidate },
      onSuccess: async (data) => {
        onSuccess(data);
        // A refetch now would erase the optimistic state of the changes still queued.
        if (hasQueued(queryClient, target.scope, target.invalidate)) return;
        const refetch = queryClient.invalidateQueries({ queryKey: target.invalidate, exact: true });
        if (target.awaitRefetch !== false) await refetch;
      },
    });
  return mutation.execute(variables);
}
