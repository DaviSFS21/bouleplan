import type { QueryClient, QueryKey } from '@tanstack/react-query';

export interface ScopedHandlers<TVariables> {
  // Runs as soon as the mutation is queued, before it waits for earlier ones in its scope.
  onMutate?: (variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

// True when another mutation of the scope waits behind the one that is finishing.
export function hasQueued(queryClient: QueryClient, scope: string): boolean {
  return (
    queryClient.isMutating({ predicate: (mutation) => mutation.options.scope?.id === scope }) > 1
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
      onSuccess: async (data) => {
        onSuccess(data);
        // A refetch now would erase the optimistic state of the changes still queued.
        if (hasQueued(queryClient, target.scope)) return;
        const refetch = queryClient.invalidateQueries({ queryKey: target.invalidate, exact: true });
        if (target.awaitRefetch !== false) await refetch;
      },
    });
  return mutation.execute(variables);
}
