import { HttpResponse } from 'msw';
import type { CalendarEvent, Initiative, Phase, ScheduledItem, Task } from '@/api/types';

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

export function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'a1a1a1a1-0000-4000-8000-000000000001',
    initiativeId: '11111111-1111-4111-8111-111111111111',
    phaseId: null,
    title: 'Comprar tinta',
    description: null,
    deadline: null,
    estimatedEffort: null,
    priority: 'P2',
    status: 'to_do',
    isBlocked: false,
    plannedWeekStart: null,
    reservedMinutes: 0,
    reservedByDeadlineMinutes: 0,
    blocks: [],
    blockedBy: [],
    createdAt: '2026-01-01T10:00:00-03:00',
    updatedAt: '2026-01-01T10:00:00-03:00',
    ...overrides,
  };
}

export function scheduledItem(overrides: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    taskId: 'a1a1a1a1-0000-4000-8000-000000000001',
    date: '2026-11-17',
    startTime: '09:00',
    endTime: '10:00',
    sortOrder: null,
    createdAt: '2026-11-16T10:00:00-03:00',
    updatedAt: '2026-11-16T10:00:00-03:00',
    ...overrides,
  };
}

export function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'f0000000-0000-4000-8000-000000000001',
    title: 'Daily',
    date: '2026-11-17',
    startTime: '09:00',
    endTime: '09:30',
    createdAt: '2026-11-16T10:00:00-03:00',
    updatedAt: '2026-11-16T10:00:00-03:00',
    ...overrides,
  };
}
