export const HOUR_HEIGHT = 48;
export const QUARTER = 15;
export const MAX_END = 23 * 60 + 45;
export const DEFAULT_BLOCK = 60;

export function parseTime(text: string): number {
  const [hours = 0, minutes = 0] = text.split(':').map(Number);
  return hours * 60 + minutes;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatApiTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatRange(start: number, end: number, spaced = false): string {
  const dash = spaced ? ' – ' : '–';
  return `${formatClock(start)}${dash}${formatClock(end)}`;
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / QUARTER) * QUARTER;
}

export function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${String(hours).replace('.', ',')}h`;
}

// What is left to reserve, or an hour when there is no estimate or nothing left.
export function durationFor(remaining: number | null): number {
  if (remaining === null || remaining <= 0) return DEFAULT_BLOCK;
  return Math.min(Math.ceil(remaining / QUARTER) * QUARTER, MAX_END);
}
