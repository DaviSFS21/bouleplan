import { describe, expect, it } from 'vitest';
import { formatDate, formatElapsed } from './initiative-dates';

const NOW = new Date(2026, 10, 17, 12, 0, 0);

function ago(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString();
}

describe('formatDate', () => {
  it('shows day and short month in the current year', () => {
    expect(formatDate(new Date(2026, 9, 12, 9).toISOString(), NOW)).toBe('12 out');
  });

  it('adds the year for other years', () => {
    expect(formatDate(new Date(2025, 11, 3, 9).toISOString(), NOW)).toBe('3 dez 2025');
  });
});

describe('formatElapsed', () => {
  it('says "agora" under a minute', () => {
    expect(formatElapsed(ago(20_000), NOW)).toBe('agora');
  });

  it('never goes negative for clock skew', () => {
    expect(formatElapsed(ago(-5000), NOW)).toBe('agora');
  });

  it('counts minutes, hours and days', () => {
    expect(formatElapsed(ago(2 * 60_000), NOW)).toBe('há 2 min');
    expect(formatElapsed(ago(3 * 3_600_000), NOW)).toBe('há 3 h');
    expect(formatElapsed(ago(3 * 86_400_000), NOW)).toBe('há 3 dias');
  });

  it('falls back to the date after a week', () => {
    expect(formatElapsed(new Date(2026, 9, 12, 9).toISOString(), NOW)).toBe('em 12 out');
  });
});
