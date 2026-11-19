import { describe, expect, it } from 'vitest';
import { firstMonth, lastMonth, parseIso, toIso } from './iso-date';

describe('parseIso', () => {
  it('reads real days of years 1 to 9999', () => {
    expect(toIso(parseIso('2026-11-18') ?? new Date(NaN))).toBe('2026-11-18');
    expect(toIso(parseIso('0001-01-01') ?? new Date(NaN))).toBe('0001-01-01');
    expect(toIso(parseIso('0099-12-31') ?? new Date(NaN))).toBe('0099-12-31');
    expect(toIso(parseIso('9999-12-31') ?? new Date(NaN))).toBe('9999-12-31');
  });

  it.each(['0000-01-01', '10000-01-01', '2026-02-30', '2026-13-01', '2026-1-1', 'hoje', ''])(
    'refuses %j',
    (text) => {
      expect(parseIso(text)).toBeNull();
    },
  );
});

describe('the limits', () => {
  it('start in January of year 1 and end in December of year 9999', () => {
    expect(toIso(firstMonth())).toBe('0001-01-01');
    expect(toIso(lastMonth())).toBe('9999-12-01');
  });
});
