export type EffortResult = { valid: true; hours: number | null } | { valid: false };

const EFFORT = /^(\d{1,3})(?:[.,](\d{1,2}))?\s*h?$/i;
const MIN_HOURS = 0.01;
const MAX_HOURS = 999;

export function parseEffort(text: string): EffortResult {
  const trimmed = text.trim();
  if (trimmed === '') return { valid: true, hours: null };
  const match = EFFORT.exec(trimmed);
  if (!match) return { valid: false };
  const hours = Number(`${match[1] ?? '0'}.${match[2] ?? '0'}`);
  return hours >= MIN_HOURS && hours <= MAX_HOURS ? { valid: true, hours } : { valid: false };
}

export function formatEffort(hours: number | null): string {
  return hours === null ? '' : `${String(hours).replace('.', ',')}h`;
}
