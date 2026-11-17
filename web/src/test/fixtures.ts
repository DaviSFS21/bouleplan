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
