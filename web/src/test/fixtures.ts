import { HttpResponse } from 'msw';
import type { Initiative, Phase } from '@/api/types';

export function initiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Reforma',
    description: null,
    overallDeadline: null,
    color: 'turquesa',
    origin: 'native',
    createdAt: '2026-01-01T10:00:00-03:00',
    updatedAt: '2026-01-01T10:00:00-03:00',
    ...overrides,
  };
}

export function phase(overrides: Partial<Phase> = {}): Phase {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    initiativeId: '11111111-1111-4111-8111-111111111111',
    name: 'Demolição',
    origin: 'native',
    createdAt: '2026-01-01T10:00:00-03:00',
    updatedAt: '2026-01-01T10:00:00-03:00',
    ...overrides,
  };
}

const reasonPhrases: Record<string, string> = {
  'http.404': 'Not Found',
  'http.405': 'Method Not Allowed',
  'http.415': 'Unsupported Media Type',
};

function problemKind(code: string): { type: string; title: string } {
  if (code === 'internal') {
    return { type: '/problems/internal', title: 'Internal error' };
  }
  if (code === 'http.400') {
    return { type: '/problems/malformed-request', title: 'Malformed request' };
  }
  if (code.startsWith('http.')) {
    return { type: '/problems/http-error', title: reasonPhrases[code] ?? 'Error' };
  }
  return { type: '/problems/rule-violation', title: 'Rule violation' };
}

export function problemResponse(code: string, status = 400, detail = 'Problem detail') {
  return HttpResponse.json(
    { ...problemKind(code), status, detail, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}
