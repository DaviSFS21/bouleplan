import { http, HttpResponse } from 'msw';
import type { Introspection } from '@/api/types';
import { problemResponse } from './fixtures';
import { server } from './server';

export const QUESTIONS = [
  { key: 'went_well', prompt: 'O que foi bom?' },
  { key: 'went_badly', prompt: 'O que foi ruim?' },
  { key: 'to_improve', prompt: 'Como posso melhorar?' },
] as const;

export function sheet(weekStart: string, overrides: Partial<Introspection> = {}): Introspection {
  return {
    weekStart,
    answers: QUESTIONS.map((question) => ({ ...question, answer: '' })),
    closedAt: null,
    updatedAt: null,
    ...overrides,
  };
}

export function answered(weekStart: string, answers: Record<string, string>): Introspection {
  return sheet(weekStart, {
    answers: QUESTIONS.map((question) => ({ ...question, answer: answers[question.key] ?? '' })),
    updatedAt: '2026-11-17T18:42:00-03:00',
  });
}

export interface IntrospectionBackend {
  sheets: Map<string, Introspection>;
  calls: string[];
  // Bodies of the PUT requests, in order.
  saves: { key: string; answer: string }[][];
  // Methods (GET, PUT, POST) answered with a 500 while listed.
  failing: Set<string>;
  // Milliseconds each PUT waits before it answers, and whether it then fails.
  slowSave: { ms: number; fail: boolean } | null;
  // The timestamp a save or a close stamps.
  stamp: string;
}

export function serveIntrospectionApi(
  initial: Introspection[] = [],
  now = '2026-11-17T18:42:00-03:00',
): IntrospectionBackend {
  const backend: IntrospectionBackend = {
    sheets: new Map(initial.map((item) => [item.weekStart, item])),
    calls: [],
    saves: [],
    failing: new Set(),
    slowSave: null,
    stamp: now,
  };
  const read = (week: unknown) => backend.sheets.get(String(week)) ?? sheet(String(week));

  server.use(
    http.get('*/api/introspections/:week', ({ params }) => {
      backend.calls.push(`GET ${String(params.week)}`);
      if (backend.failing.has('GET')) return problemResponse('internal', 500);
      return HttpResponse.json(read(params.week));
    }),
    http.put('*/api/introspections/:week', async ({ params, request }) => {
      const body = (await request.json()) as { answers: { key: string; answer: string }[] };
      backend.calls.push(`PUT ${String(params.week)}`);
      backend.saves.push(body.answers);
      const slow = backend.slowSave;
      if (slow) {
        await new Promise((resolve) => setTimeout(resolve, slow.ms));
        if (slow.fail) return problemResponse('internal', 500);
      }
      if (backend.failing.has('PUT')) return problemResponse('internal', 500);
      const current = read(params.week);
      if (current.closedAt) return problemResponse('introspection.closed', 409);
      const saved: Introspection = {
        ...current,
        updatedAt: backend.stamp,
        answers: current.answers.map((entry) => {
          const change = body.answers.find(({ key }) => key === entry.key);
          return change ? { ...entry, answer: change.answer.replaceAll('\r\n', '\n') } : entry;
        }),
      };
      backend.sheets.set(String(params.week), saved);
      return HttpResponse.json(saved);
    }),
    http.post('*/api/introspections/:week/close', ({ params }) => {
      backend.calls.push(`POST ${String(params.week)}`);
      if (backend.failing.has('POST')) return problemResponse('internal', 500);
      const current = read(params.week);
      if (current.closedAt) return problemResponse('introspection.closed', 409);
      const closed = { ...current, closedAt: backend.stamp, updatedAt: backend.stamp };
      backend.sheets.set(String(params.week), closed);
      return HttpResponse.json(closed);
    }),
  );
  return backend;
}
