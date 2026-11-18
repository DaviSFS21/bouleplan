import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, unwrap } from './client';
import { toApiError } from './problem';
import { runScoped } from './scoped-mutation';
import type { AnswerKey, Introspection } from './types';

export const introspectionKey = (weekStart: string) => ['introspection', weekStart] as const;

export function useIntrospection(weekStart: string) {
  return useQuery({
    queryKey: introspectionKey(weekStart),
    queryFn: () =>
      unwrap(api.GET('/introspections/{weekStart}', { params: { path: { weekStart } } })),
  });
}

function scopeOf(weekStart: string) {
  return { scope: `introspection-${weekStart}`, invalidate: introspectionKey(weekStart) };
}

// Only the saved answer: another answer may already be newer on screen.
function withSaved(sheet: Introspection | undefined, saved: Introspection, key: AnswerKey) {
  if (!sheet) return saved;
  const answer = saved.answers.find((entry) => entry.key === key);
  return {
    ...sheet,
    updatedAt: saved.updatedAt,
    answers: sheet.answers.map((entry) =>
      entry.key === key && answer ? { ...entry, answer: answer.answer } : entry,
    ),
  };
}

function set(queryClient: QueryClient, weekStart: string, change: Introspection) {
  queryClient.setQueryData<Introspection>(introspectionKey(weekStart), change);
}

export interface SaveAnswerInput {
  weekStart: string;
  key: AnswerKey;
  answer: string;
}

export function useSaveAnswer() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: ({ weekStart, key, answer }: SaveAnswerInput) =>
        // One scope per sheet: saves reach the server in the order they were made.
        runScoped(
          queryClient,
          { ...scopeOf(weekStart), awaitRefetch: false },
          { answers: [{ key, answer }] },
          (body) =>
            unwrap(
              api.PUT('/introspections/{weekStart}', {
                params: { path: { weekStart } },
                body,
              }),
            ),
          (saved) => {
            queryClient.setQueryData<Introspection>(introspectionKey(weekStart), (sheet) =>
              withSaved(sheet, saved, key),
            );
          },
        ),
    }),
    [queryClient],
  );
}

export function useSaveAnswerKeepalive() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      // For a page that is going away: it skips the queue so the request is sent before the page dies.
      send: async ({ weekStart, key, answer }: SaveAnswerInput): Promise<void> => {
        const response = await fetch(
          new Request(`/api/introspections/${weekStart}`, {
            method: 'PUT',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: [{ key, answer }] }),
          }),
        );
        const payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok) throw toApiError(payload, response);
        queryClient.setQueryData<Introspection>(introspectionKey(weekStart), (sheet) =>
          withSaved(sheet, payload as Introspection, key),
        );
      },
    }),
    [queryClient],
  );
}

export function useCloseIntrospection() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      mutateAsync: (weekStart: string) =>
        runScoped(
          queryClient,
          { ...scopeOf(weekStart), awaitRefetch: false },
          weekStart,
          (week) =>
            unwrap(
              api.POST('/introspections/{weekStart}/close', {
                params: { path: { weekStart: week } },
              }),
            ),
          (closed) => {
            set(queryClient, weekStart, closed);
          },
        ),
    }),
    [queryClient],
  );
}
