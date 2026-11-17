import { HttpResponse } from 'msw';
import type { Initiative } from '@/api/types';

export function initiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Reforma',
    description: null,
    overallDeadline: null,
    color: 'turquesa',
    origin: 'native',
    createdAt: '2026-01-01T10:00:00-03:00',
    ...overrides,
  };
}

export function problemResponse(code: string, status = 400, detail = 'Problem detail') {
  const type = status === 400 ? '/problems/rule-violation' : 'about:blank';
  return HttpResponse.json(
    { type, title: 'Rule violation', status, detail, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}
